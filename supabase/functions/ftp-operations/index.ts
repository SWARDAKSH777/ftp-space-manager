
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to parse passive mode response
function parsePasvResponse(response: string): { host: string; port: number } | null {
  const match = response.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) return null;
  
  const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  const port = parseInt(match[5]) * 256 + parseInt(match[6]);
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
      timeout: 30000
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
      await this.readResponse();
      
      // Login
      await this.sendCommand(`USER ${this.config.username}`);
      await this.sendCommand(`PASS ${this.config.password}`);
      
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
    
    console.log(`FTP Command: ${command.replace(/PASS .+/, 'PASS [hidden]')}`);
    
    const encoder = new TextEncoder();
    await this.controlConn.write(encoder.encode(command + "\r\n"));
    
    return await this.readResponse();
  }

  private async readResponse(): Promise<string> {
    if (!this.controlConn) throw new Error("Not connected");
    
    const buffer = new Uint8Array(4096);
    let response = "";
    
    const timeoutId = setTimeout(() => {
      throw new Error("FTP response timeout");
    }, this.config.timeout);
    
    try {
      while (true) {
        const n = await this.controlConn.read(buffer);
        if (n === null) break;
        
        const chunk = new TextDecoder().decode(buffer.subarray(0, n));
        response += chunk;
        
        // Check if we have a complete response (ends with \r\n and starts with 3-digit code)
        const lines = response.split('\r\n');
        const lastCompleteLine = lines[lines.length - 2]; // -2 because last element is empty after split
        
        if (lastCompleteLine && /^\d{3} /.test(lastCompleteLine)) {
          break;
        }
      }
      
      clearTimeout(timeoutId);
      console.log(`FTP Response: ${response.trim()}`);
      return response.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async listFiles(path: string = "/"): Promise<any[]> {
    try {
      // Set binary mode
      await this.sendCommand("TYPE I");
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        // Use passive mode
        const pasvResponse = await this.sendCommand("PASV");
        const pasvData = parsePasvResponse(pasvResponse);
        
        if (!pasvData) {
          throw new Error("Failed to parse PASV response");
        }
        
        console.log(`Connecting to data port: ${pasvData.host}:${pasvData.port}`);
        dataConn = await Deno.connect({
          hostname: pasvData.host,
          port: pasvData.port,
          transport: "tcp"
        });
      } else {
        throw new Error("Active mode not implemented in this version");
      }

      // Send LIST command
      const listResponse = await this.sendCommand(`LIST ${path}`);
      console.log(`LIST Response: ${listResponse}`);

      // Read data from data connection
      const fileListData = await this.readDataConnection(dataConn);
      console.log(`File list data: ${fileListData}`);

      // Parse the file list
      const files = this.parseFileList(fileListData, path);
      
      return files;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async uploadFile(fileData: any): Promise<boolean> {
    try {
      await this.sendCommand("TYPE I");
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        const pasvResponse = await this.sendCommand("PASV");
        const pasvData = parsePasvResponse(pasvResponse);
        
        if (!pasvData) {
          throw new Error("Failed to parse PASV response");
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
      
      // Send file data
      const fileContent = Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0));
      await dataConn.write(fileContent);
      dataConn.close();
      
      // Read final response
      await this.readResponse();
      
      console.log("File upload completed");
      return true;
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async downloadFile(remotePath: string): Promise<string> {
    try {
      await this.sendCommand("TYPE I");
      
      let dataConn: Deno.Conn;
      
      if (this.config.passive_mode) {
        const pasvResponse = await this.sendCommand("PASV");
        const pasvData = parsePasvResponse(pasvResponse);
        
        if (!pasvData) {
          throw new Error("Failed to parse PASV response");
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
      await this.sendCommand(`RETR ${remotePath}`);
      
      // Read file data
      const fileData = await this.readDataConnection(dataConn);
      
      // Read final response
      await this.readResponse();
      
      return btoa(fileData);
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    try {
      await this.sendCommand(`DELE ${remotePath}`);
      return true;
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async createDirectory(remotePath: string): Promise<boolean> {
    try {
      await this.sendCommand(`MKD ${remotePath}`);
      return true;
    } catch (error) {
      throw new Error(`Create directory failed: ${error.message}`);
    }
  }

  private async readDataConnection(conn: Deno.Conn): Promise<string> {
    const chunks: Uint8Array[] = [];
    const buffer = new Uint8Array(8192);
    
    try {
      while (true) {
        const n = await conn.read(buffer);
        if (n === null) break;
        chunks.push(buffer.slice(0, n));
      }
    } finally {
      conn.close();
    }
    
    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
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
    console.log(`FTP operation: ${action}`);

    // Get server config from database or use provided config
    let serverConfig = config;
    
    if (!serverConfig) {
      // This would be implemented to fetch from server_config table
      // For now, we'll expect config to be provided or use defaults
      throw new Error("Server configuration not provided");
    }

    const ftpClient = new SecureFTPClient(serverConfig);
    
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
          await ftpClient.uploadFile(fileData);
          result = { success: true, message: "File uploaded successfully" };
          break;
          
        case 'download_file':
          const content = await ftpClient.downloadFile(path);
          result = { success: true, content };
          break;
          
        case 'delete_file':
          await ftpClient.deleteFile(path);
          result = { success: true, message: "File deleted successfully" };
          break;
          
        case 'create_directory':
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
