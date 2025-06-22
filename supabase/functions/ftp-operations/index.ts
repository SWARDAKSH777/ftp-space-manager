
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

// Enhanced FTP client with better error handling and timeouts
class SecureFTPClient {
  private controlConn: Deno.Conn | null = null;
  private config: any;
  private isConnected = false;

  constructor(config: any) {
    this.config = {
      host: config.host,
      port: config.port || 21,
      username: config.username,
      password: config.password,
      passive_mode: config.passive_mode ?? true,
      timeout: 30000 // Increased timeout
    };
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to FTP server: ${this.config.host}:${this.config.port}`);
      
      // Add connection timeout
      const connectPromise = Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
        transport: "tcp"
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Connection timeout")), 10000);
      });

      this.controlConn = await Promise.race([connectPromise, timeoutPromise]);

      // Read welcome message with timeout
      const welcome = await this.readResponse();
      console.log(`Welcome message: ${welcome}`);
      
      if (!welcome.startsWith('220')) {
        throw new Error(`Unexpected welcome message: ${welcome}`);
      }
      
      // Login
      const userResp = await this.sendCommand(`USER ${this.config.username}`);
      if (!userResp.startsWith('331')) {
        throw new Error(`Unexpected USER response: ${userResp}`);
      }
      
      const passResp = await this.sendCommand(`PASS ${this.config.password}`);
      if (!passResp.startsWith('230')) {
        throw new Error(`Authentication failed: ${passResp}`);
      }
      
      this.isConnected = true;
      console.log("FTP login successful");
    } catch (error) {
      await this.disconnect();
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.controlConn && this.isConnected) {
        try {
          await this.sendCommand("QUIT");
        } catch (e) {
          console.log("Error sending QUIT:", e);
        }
      }
      if (this.controlConn) {
        this.controlConn.close();
        this.controlConn = null;
      }
      this.isConnected = false;
    } catch (error) {
      console.log("Error during disconnect:", error);
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.controlConn || !this.isConnected) {
      throw new Error("Not connected to FTP server");
    }
    
    const logCommand = command.startsWith('PASS') ? 'PASS [hidden]' : command;
    console.log(`FTP Command: ${logCommand}`);
    
    try {
      const encoder = new TextEncoder();
      await this.controlConn.write(encoder.encode(command + "\r\n"));
      
      return await this.readResponse();
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  private async readResponse(): Promise<string> {
    if (!this.controlConn) {
      throw new Error("No connection available");
    }
    
    const buffer = new Uint8Array(4096);
    let response = "";
    let attempts = 0;
    const maxAttempts = 20;
    
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
          this.isConnected = false;
          break;
        }
        
        const chunk = new TextDecoder().decode(buffer.subarray(0, result));
        response += chunk;
        
        // Check for complete response - look for status code followed by space or end
        const lines = response.split('\r\n');
        for (const line of lines) {
          if (line && /^\d{3} /.test(line)) {
            console.log(`FTP Response: ${response.trim()}`);
            return response.trim();
          }
        }
        
        // Prevent infinite loops
        if (response.length > 50000) {
          console.warn("Response too long, breaking");
          break;
        }
        
        // Small delay to prevent tight loops
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (attempts >= maxAttempts) {
        throw new Error("Maximum read attempts reached");
      }
      
      console.log(`FTP Response: ${response.trim()}`);
      return response.trim();
    } catch (error) {
      this.isConnected = false;
      if (error.message === "Response timeout") {
        throw new Error("FTP server response timeout");
      }
      throw error;
    }
  }

  async listFiles(path: string = "/"): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    let dataConn: Deno.Conn | null = null;
    
    try {
      // Set binary mode
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
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
        
        // Connect to data port with timeout
        const dataConnectPromise = Deno.connect({
          hostname: pasvData.host,
          port: pasvData.port,
          transport: "tcp"
        });
        
        const dataTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Data connection timeout")), 10000);
        });
        
        dataConn = await Promise.race([dataConnectPromise, dataTimeoutPromise]);
      } else {
        throw new Error("Active mode not implemented in this version");
      }

      // Send LIST command
      const listResponse = await this.sendCommand(`LIST ${path}`);
      if (!listResponse.startsWith('150') && !listResponse.startsWith('125')) {
        if (dataConn) dataConn.close();
        throw new Error(`LIST command failed: ${listResponse}`);
      }

      // Read data from data connection
      const fileListData = await this.readDataConnection(dataConn);
      console.log(`File list data received: ${fileListData.length} bytes`);

      // Read final response after data transfer
      const finalResp = await this.readResponse();
      if (!finalResp.startsWith('226')) {
        console.warn(`Unexpected final response: ${finalResp}`);
      }

      // Parse the file list
      const files = this.parseFileList(fileListData, path);
      console.log(`Parsed ${files.length} files`);
      
      return files;
    } catch (error) {
      if (dataConn) {
        try {
          dataConn.close();
        } catch (e) {
          console.log("Error closing data connection:", e);
        }
      }
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
    const maxBytes = 50 * 1024 * 1024; // 50MB limit
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Data read timeout")), 30000);
      });
      
      while (totalBytes < maxBytes) {
        const readPromise = conn.read(buffer);
        const n = await Promise.race([readPromise, timeoutPromise]);
        
        if (n === null) break;
        
        chunks.push(buffer.slice(0, n));
        totalBytes += n;
        
        // Add small delay to prevent overwhelming
        if (chunks.length % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
    } finally {
      try {
        conn.close();
      } catch (e) {
        console.log("Error closing data connection:", e);
      }
    }
    
    if (totalBytes >= maxBytes) {
      throw new Error("File data too large - exceeds 50MB limit");
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
      const parentPath = basePath.split('/').slice(0, -1).join('/') || '/';
      files.push({
        name: '..',
        type: 'directory',
        size: 0,
        modified_at: new Date().toISOString(),
        path: parentPath
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

  async uploadFile(fileData: any): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    let dataConn: Deno.Conn | null = null;
    
    try {
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
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
        if (dataConn) dataConn.close();
        throw new Error(`STOR command failed: ${storResponse}`);
      }
      
      // Send file data
      const fileContent = Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0));
      await dataConn.write(fileContent);
      dataConn.close();
      dataConn = null;
      
      // Read final response
      const finalResp = await this.readResponse();
      if (!finalResp.startsWith('226')) {
        throw new Error(`Upload failed: ${finalResp}`);
      }
      
      console.log("File upload completed");
      return true;
    } catch (error) {
      if (dataConn) {
        try {
          dataConn.close();
        } catch (e) {
          console.log("Error closing data connection:", e);
        }
      }
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async downloadFile(remotePath: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    let dataConn: Deno.Conn | null = null;
    
    try {
      const typeResp = await this.sendCommand("TYPE I");
      if (!typeResp.startsWith('200')) {
        throw new Error(`Failed to set binary mode: ${typeResp}`);
      }
      
      if (this.config.passive_mode) {
        const pasvResponse = await this.sendCommand("PASV");
        if (!pasvResponse.startsWith('227')) {
          throw new Error(`PASV command failed: ${pasvResponse}`);
        }
        
        const pasvData = parsePasvResponse(pasvResponse);
        if (!pasvData) {
          throw new Error(`Failed to parse PASV response: ${pasvData}`);
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
        if (dataConn) dataConn.close();
        throw new Error(`RETR command failed: ${retrResponse}`);
      }
      
      // Read file data
      const fileData = await this.readDataConnection(dataConn);
      dataConn = null;
      
      // Read final response
      const finalResp = await this.readResponse();
      if (!finalResp.startsWith('226')) {
        throw new Error(`Download failed: ${finalResp}`);
      }
      
      return btoa(fileData);
    } catch (error) {
      if (dataConn) {
        try {
          dataConn.close();
        } catch (e) {
          console.log("Error closing data connection:", e);
        }
      }
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

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
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

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
    let result;
    
    try {
      await ftpClient.connect();
      
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
