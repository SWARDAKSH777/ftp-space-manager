
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to parse passive mode response
function parsePasvResponse(response: string): { host: string; port: number } | null {
  console.log(`Parsing PASV response: "${response}"`);
  const match = response.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) {
    console.error(`Failed to parse PASV response: ${response}`);
    return null;
  }
  
  const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  const port = parseInt(match[5]) * 256 + parseInt(match[6]);
  console.log(`Parsed PASV: host=${host}, port=${port}`);
  return { host, port };
}

// Enhanced FTP client with better connection management
class SecureFTPClient {
  private controlConn: Deno.Conn | null = null;
  private config: any;

  constructor(config: any) {
    this.config = {
      host: config.host,
      port: config.port || 21,
      username: config.username,
      password: config.password,
      passive_mode: config.passive_mode ?? true,
      timeout: 15000 // Reduced timeout to prevent hanging
    };
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to FTP server: ${this.config.host}:${this.config.port}`);
      
      this.controlConn = await Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
        transport: "tcp"
      });

      // Read welcome message
      const welcome = await this.readResponse();
      console.log(`Welcome message: ${welcome}`);
      
      // Login
      const userResp = await this.sendCommand(`USER ${this.config.username}`);
      if (!userResp.startsWith('331')) {
        throw new Error(`Unexpected USER response: ${userResp}`);
      }
      
      const passResp = await this.sendCommand(`PASS ${this.config.password}`);
      if (!passResp.startsWith('230')) {
        throw new Error(`Authentication failed: ${passResp}`);
      }
      
      console.log("FTP login successful");
    } catch (error) {
      await this.disconnect();
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.controlConn) {
        await this.sendCommand("QUIT").catch(() => {});
        this.controlConn.close();
        this.controlConn = null;
      }
    } catch (error) {
      console.log("Error during disconnect:", error);
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.controlConn) throw new Error("Not connected");
    
    const logCommand = command.startsWith('PASS') ? 'PASS [hidden]' : command;
    console.log(`FTP Command: ${logCommand}`);
    
    const encoder = new TextEncoder();
    await this.controlConn.write(encoder.encode(command + "\r\n"));
    
    return await this.readResponse();
  }

  private async readResponse(): Promise<string> {
    if (!this.controlConn) throw new Error("Not connected");
    
    const buffer = new Uint8Array(4096);
    let response = "";
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Response timeout")), this.config.timeout);
    });
    
    try {
      while (attempts < maxAttempts) {
        attempts++;
        
        const readPromise = this.controlConn.read(buffer);
        const result = await Promise.race([readPromise, timeoutPromise]);
        
        if (result === null) {
          console.log("Connection closed by server");
          break;
        }
        
        const chunk = new TextDecoder().decode(buffer.subarray(0, result));
        response += chunk;
        
        // Check if we have a complete response
        const lines = response.split('\r\n');
        
        // Look for a line that starts with a 3-digit code followed by a space (final response)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && /^\d{3} /.test(line)) {
            console.log(`FTP Response: ${response.trim()}`);
            return response.trim();
          }
        }
        
        // Prevent infinite loop
        if (response.length > 10000) {
          console.warn("Response too long, breaking");
          break;
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error("Too many read attempts, possible infinite loop");
      }
      
      console.log(`FTP Response: ${response.trim()}`);
      return response.trim();
    } catch (error) {
      if (error.message === "Response timeout") {
        throw new Error("FTP response timeout - server may be unresponsive");
      }
      throw error;
    }
  }

  async listFiles(path: string = "/"): Promise<any[]> {
    try {
      // Set binary mode
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        // Use passive mode
        const pasvResponse = await this.sendCommand("PASV");
        if (!pasvResponse.startsWith('227')) {
          throw new Error(`PASV command failed: ${pasvResponse}`);
        }
        
        const pasvData = parsePasvResponse(pasvResponse);
        if (!pasvData) {
          throw new Error(`Failed to parse PASV response: ${pasvResponse}`);
        }
        
        console.log(`Connecting to data port: ${pasvData.host}:${pasvData.port}`);
        try {
          dataConn = await Deno.connect({
            hostname: pasvData.host,
            port: pasvData.port,
            transport: "tcp"
          });
        } catch (error) {
          throw new Error(`Failed to connect to data port: ${error.message}`);
        }
      } else {
        throw new Error("Active mode not implemented in this version");
      }

      // Send LIST command
      const listResponse = await this.sendCommand(`LIST ${path}`);
      if (!listResponse.startsWith('150') && !listResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`LIST command failed: ${listResponse}`);
      }

      // Read data from data connection
      const fileListData = await this.readDataConnection(dataConn);
      console.log(`File list data: ${fileListData}`);

      // Read final response after data transfer
      await this.readResponse();

      // Parse the file list
      const files = this.parseFileList(fileListData, path);
      
      return files;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async uploadFile(fileData: any): Promise<boolean> {
    try {
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        const pasvResponse = await this.sendCommand("PASV");
        if (!pasvResponse.startsWith('227')) {
          throw new Error(`PASV command failed: ${pasvResponse}`);
        }
        
        const pasvData = parsePasvResponse(pasvResponse);
        if (!pasvData) {
          throw new Error(`Failed to parse PASV response: ${pasvResponse}`);
        }
        
        dataConn = await Deno.connect({
          hostname: pasvData.host,
          port: pasvData.port,
          transport: "tcp"
        });
      } else {
        throw new Error("Active mode not implemented");
      }

      // Start upload
      console.log(`Uploading file to ${fileData.remotePath}`);
      const storResponse = await this.sendCommand(`STOR ${fileData.remotePath}`);
      if (!storResponse.startsWith('150') && !storResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`STOR command failed: ${storResponse}`);
      }
      
      // Send file data
      const fileContent = Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0));
      await dataConn.write(fileContent);
      dataConn.close();
      
      // Read final response
      const finalResp = await this.readResponse();
      if (!finalResp.startsWith('226')) {
        throw new Error(`Upload failed: ${finalResp}`);
      }
      
      console.log("File upload completed");
      return true;
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async downloadFile(remotePath: string): Promise<string> {
    try {
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        const pasvResponse = await this.sendCommand("PASV");
        if (!pasvResponse.startsWith('227')) {
          throw new Error(`PASV command failed: ${pasvResponse}`);
        }
        
        const pasvData = parsePasvResponse(pasvResponse);
        if (!pasvData) {
          throw new Error(`Failed to parse PASV response: ${pasvResponse}`);
        }
        
        dataConn = await Deno.connect({
          hostname: pasvData.host,
          port: pasvData.port,
          transport: "tcp"
        });
      } else {
        throw new Error("Active mode not implemented");
      }

      // Start download
      const retrResponse = await this.sendCommand(`RETR ${remotePath}`);
      if (!retrResponse.startsWith('150') && !retrResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`RETR command failed: ${retrResponse}`);
      }
      
      // Read file data
      const fileData = await this.readDataConnection(dataConn);
      
      // Read final response
      const finalResp = await this.readResponse();
      if (!finalResp.startsWith('226')) {
        throw new Error(`Download failed: ${finalResp}`);
      }
      
      return btoa(fileData);
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    try {
      const deleteResp = await this.sendCommand(`DELE ${remotePath}`);
      if (!deleteResp.startsWith('250')) {
        throw new Error(`Delete failed: ${deleteResp}`);
      }
      return true;
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async createDirectory(remotePath: string): Promise<boolean> {
    try {
      const mkdResp = await this.sendCommand(`MKD ${remotePath}`);
      if (!mkdResp.startsWith('257')) {
        throw new Error(`Create directory failed: ${mkdResp}`);
      }
      return true;
    } catch (error) {
      throw new Error(`Create directory failed: ${error.message}`);
    }
  }

  private async readDataConnection(conn: Deno.Conn): Promise<string> {
    const chunks: Uint8Array[] = [];
    const buffer = new Uint8Array(8192);
    let totalBytes = 0;
    const maxBytes = 50 * 1024 * 1024; // 50MB limit to prevent memory issues
    
    try {
      while (totalBytes < maxBytes) {
        const n = await conn.read(buffer);
        if (n === null) break;
        
        chunks.push(buffer.slice(0, n));
        totalBytes += n;
      }
    } finally {
      conn.close();
    }
    
    if (totalBytes >= maxBytes) {
      throw new Error("File too large - exceeds 50MB limit");
    }
    
    // Combine all chunks
    const result = new Uint8Array(totalBytes);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new TextDecoder().decode(result);
  }

  private parseFileList(data: string, basePath: string): any[] {
    const lines = data.split('\n').filter(line => line.trim());
    const files: any[] = [];
    
    // Add parent directory entry if not at root
    if (basePath !== '/' && basePath !== '') {
      files.push({
        name: '..',
        type: 'directory',
        size: 0,
        modified_at: new Date().toISOString(),
        path: basePath.split('/').slice(0, -1).join('/') || '/'
      });
    }
    
    for (const line of lines) {
      try {
        // Parse Unix-style listing (most common)
        const match = line.match(/^([-dlrwx]+)\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+\s+\S+)\s+(.+)$/);
        if (match) {
          const [, permissions, size, dateStr, name] = match;
          
          // Skip current directory and parent directory entries in the raw listing
          if (name === '.' || name === '..') continue;
          
          const isDirectory = permissions.startsWith('d');
          const filePath = basePath === '/' ? `/${name}` : `${basePath}/${name}`;
          
          files.push({
            name: name,
            type: isDirectory ? 'directory' : 'file',
            size: parseInt(size) || 0,
            modified_at: new Date().toISOString(), // Simplified for now
            path: filePath,
            permissions: permissions
          });
        }
      } catch (error) {
        console.warn(`Failed to parse line: ${line}`, error);
      }
    }
    
    return files;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, path, fileData, config } = await req.json();
    console.log(`FTP operation: ${action}, path: ${path}`);

    // Validate required config
    if (!config || !config.host || !config.username || !config.password) {
      throw new Error("Missing required server configuration");
    }

    const ftpClient = new SecureFTPClient(config);
    
    try {
      await ftpClient.connect();
      
      let result;
      
      switch (action) {
        case 'test_connection':
          result = { success: true, message: "Connection successful" };
          break;
          
        case 'list_files':
          const files = await ftpClient.listFiles(path || '/');
          result = { success: true, files };
          break;
          
        case 'upload_file':
          if (!fileData) {
            throw new Error("File data is required for upload");
          }
          await ftpClient.uploadFile(fileData);
          result = { success: true, message: "File uploaded successfully" };
          break;
          
        case 'download_file':
          if (!path) {
            throw new Error("File path is required for download");
          }
          const content = await ftpClient.downloadFile(path);
          result = { success: true, content };
          break;
          
        case 'delete_file':
          if (!path) {
            throw new Error("File path is required for delete");
          }
          await ftpClient.deleteFile(path);
          result = { success: true, message: "File deleted successfully" };
          break;
          
        case 'create_directory':
          if (!path) {
            throw new Error("Directory path is required");
          }
          await ftpClient.createDirectory(path);
          result = { success: true, message: "Directory created successfully" };
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } finally {
      await ftpClient.disconnect();
    }
    
  } catch (error) {
    console.error('FTP operation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
