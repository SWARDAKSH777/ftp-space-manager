
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FTP Client implementation
class FTPClient {
  private config: any;
  private isConnected = false;
  private controlConnection: Deno.Conn | null = null;
  private dataConnection: Deno.Conn | null = null;

  constructor(config: any) {
    this.config = {
      host: config.host,
      port: config.port || 21,
      username: config.username,
      password: config.password,
      passive_mode: config.passive_mode !== false, // default to true
      timeout: 30000
    };
  }

  private async readResponse(conn: Deno.Conn): Promise<string> {
    const buffer = new Uint8Array(1024);
    let response = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const n = await conn.read(buffer);
        if (n === null) break;
        
        const chunk = new TextDecoder().decode(buffer.subarray(0, n));
        response += chunk;
        
        // Check if we have a complete response (ends with \r\n and has status code)
        if (response.includes('\r\n') && /^\d{3}/.test(response)) {
          const lines = response.split('\r\n');
          const lastLine = lines[lines.length - 2]; // -2 because last is empty
          if (lastLine && /^\d{3} /.test(lastLine)) {
            break;
          }
        }
        attempts++;
      } catch (error) {
        console.error('Error reading response:', error);
        break;
      }
    }
    
    return response.trim();
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.controlConnection) {
      throw new Error("Not connected to FTP server");
    }

    console.log(`Sending FTP command: ${command}`);
    
    const commandBytes = new TextEncoder().encode(command + '\r\n');
    await this.controlConnection.write(commandBytes);
    
    const response = await this.readResponse(this.controlConnection);
    console.log(`FTP Response: ${response}`);
    
    return response;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to FTP server: ${this.config.host}:${this.config.port}`);
      
      // Establish control connection
      this.controlConnection = await Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
        transport: "tcp"
      });
      
      // Read welcome message
      const welcome = await this.readResponse(this.controlConnection);
      console.log(`Welcome message: ${welcome}`);
      
      if (!welcome.startsWith('220')) {
        throw new Error(`Invalid FTP server response: ${welcome}`);
      }

      // Send USER command
      const userResponse = await this.sendCommand(`USER ${this.config.username}`);
      if (!userResponse.startsWith('331') && !userResponse.startsWith('230')) {
        throw new Error(`USER command failed: ${userResponse}`);
      }

      // Send PASS command if needed
      if (userResponse.startsWith('331')) {
        const passResponse = await this.sendCommand(`PASS ${this.config.password}`);
        if (!passResponse.startsWith('230')) {
          throw new Error(`PASS command failed: ${passResponse}`);
        }
      }

      // Set passive mode if configured
      if (this.config.passive_mode) {
        await this.sendCommand('PASV');
      }

      this.isConnected = true;
      console.log("FTP connection successful");
      
    } catch (error) {
      console.error(`FTP connection failed: ${error.message}`);
      if (this.controlConnection) {
        try {
          this.controlConnection.close();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
        this.controlConnection = null;
      }
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.controlConnection) {
        await this.sendCommand('QUIT');
        this.controlConnection.close();
        this.controlConnection = null;
      }
      if (this.dataConnection) {
        this.dataConnection.close();
        this.dataConnection = null;
      }
      this.isConnected = false;
      console.log("FTP disconnected");
    } catch (error) {
      console.log("Error during FTP disconnect:", error);
    }
  }

  private async establishDataConnection(): Promise<Deno.Conn> {
    if (!this.config.passive_mode) {
      throw new Error("Active mode not implemented");
    }

    const pasvResponse = await this.sendCommand('PASV');
    if (!pasvResponse.startsWith('227')) {
      throw new Error(`PASV command failed: ${pasvResponse}`);
    }

    // Parse PASV response to get IP and port
    const match = pasvResponse.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) {
      throw new Error(`Invalid PASV response: ${pasvResponse}`);
    }

    const ip = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
    const port = parseInt(match[5]) * 256 + parseInt(match[6]);

    console.log(`Connecting to data port: ${ip}:${port}`);
    
    const dataConn = await Deno.connect({
      hostname: ip,
      port: port,
      transport: "tcp"
    });

    return dataConn;
  }

  async listFiles(path: string = "/"): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Listing FTP files for path: ${path}`);
      
      // Change to the specified directory
      if (path !== '/') {
        const cwdResponse = await this.sendCommand(`CWD ${path}`);
        if (!cwdResponse.startsWith('250')) {
          throw new Error(`CWD command failed: ${cwdResponse}`);
        }
      }

      // Establish data connection for LIST command
      const dataConn = await this.establishDataConnection();
      
      // Send LIST command
      const listResponse = await this.sendCommand('LIST');
      if (!listResponse.startsWith('150') && !listResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`LIST command failed: ${listResponse}`);
      }

      // Read directory listing from data connection
      let listing = '';
      const buffer = new Uint8Array(4096);
      
      try {
        while (true) {
          const n = await dataConn.read(buffer);
          if (n === null) break;
          listing += new TextDecoder().decode(buffer.subarray(0, n));
        }
      } catch (error) {
        console.log('Finished reading data connection');
      }
      
      dataConn.close();

      // Wait for transfer complete message
      const transferResponse = await this.readResponse(this.controlConnection!);
      console.log(`Transfer response: ${transferResponse}`);

      // Parse the listing
      const files = this.parseDirectoryListing(listing, path);
      console.log(`FTP listed ${files.length} files`);
      return files;
      
    } catch (error) {
      throw new Error(`Failed to list FTP files: ${error.message}`);
    }
  }

  private parseDirectoryListing(listing: string, currentPath: string): any[] {
    const files: any[] = [];
    const lines = listing.split('\n').filter(line => line.trim());

    // Add parent directory entry if not at root
    if (currentPath !== '/') {
      files.push({
        name: '..',
        type: 'directory',
        size: 0,
        modified_at: new Date().toISOString(),
        path: currentPath.split('/').slice(0, -1).join('/') || '/',
        permissions: 'drwxr-xr-x'
      });
    }

    for (const line of lines) {
      try {
        // Parse Unix-style listing (drwxrwxrwx format)
        const match = line.match(/^([-d])([-rwx]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+\s+\S+)\s+(.+)$/);
        if (match) {
          const [, typeChar, permissions, size, dateStr, name] = match;
          
          if (name === '.' || name === '..') continue;
          
          const type = typeChar === 'd' ? 'directory' : 'file';
          const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
          
          files.push({
            name,
            type,
            size: parseInt(size),
            modified_at: new Date().toISOString(), // TODO: parse actual date
            path: filePath,
            permissions: typeChar + permissions
          });
        }
      } catch (error) {
        console.log(`Error parsing line: ${line}`, error);
      }
    }

    return files;
  }

  async uploadFile(fileData: any): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Uploading file to FTP: ${fileData.remotePath}`);
      
      // Establish data connection
      const dataConn = await this.establishDataConnection();
      
      // Send STOR command
      const storResponse = await this.sendCommand(`STOR ${fileData.remotePath}`);
      if (!storResponse.startsWith('150') && !storResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`STOR command failed: ${storResponse}`);
      }

      // Upload file data
      const fileContent = new TextEncoder().encode(atob(fileData.content));
      await dataConn.write(fileContent);
      dataConn.close();

      // Wait for transfer complete message
      const transferResponse = await this.readResponse(this.controlConnection!);
      if (!transferResponse.startsWith('226')) {
        throw new Error(`Upload failed: ${transferResponse}`);
      }
      
      console.log("FTP file upload completed");
      return true;
      
    } catch (error) {
      throw new Error(`FTP upload failed: ${error.message}`);
    }
  }

  async downloadFile(remotePath: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Downloading file from FTP: ${remotePath}`);
      
      // Establish data connection
      const dataConn = await this.establishDataConnection();
      
      // Send RETR command
      const retrResponse = await this.sendCommand(`RETR ${remotePath}`);
      if (!retrResponse.startsWith('150') && !retrResponse.startsWith('125')) {
        dataConn.close();
        throw new Error(`RETR command failed: ${retrResponse}`);
      }

      // Download file data
      let fileData = '';
      const buffer = new Uint8Array(4096);
      
      try {
        while (true) {
          const n = await dataConn.read(buffer);
          if (n === null) break;
          fileData += new TextDecoder().decode(buffer.subarray(0, n));
        }
      } catch (error) {
        console.log('Finished downloading file');
      }
      
      dataConn.close();

      // Wait for transfer complete message
      const transferResponse = await this.readResponse(this.controlConnection!);
      console.log(`Download transfer response: ${transferResponse}`);
      
      console.log("FTP file download completed");
      return btoa(fileData);
      
    } catch (error) {
      throw new Error(`FTP download failed: ${error.message}`);
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Deleting file from FTP: ${remotePath}`);
      
      const deleResponse = await this.sendCommand(`DELE ${remotePath}`);
      if (!deleResponse.startsWith('250')) {
        throw new Error(`DELE command failed: ${deleResponse}`);
      }
      
      console.log("FTP file deletion completed");
      return true;
      
    } catch (error) {
      throw new Error(`FTP delete failed: ${error.message}`);
    }
  }

  async createDirectory(remotePath: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Creating directory on FTP: ${remotePath}`);
      
      const mkdResponse = await this.sendCommand(`MKD ${remotePath}`);
      if (!mkdResponse.startsWith('257')) {
        throw new Error(`MKD command failed: ${mkdResponse}`);
      }
      
      console.log("FTP directory creation completed");
      return true;
      
    } catch (error) {
      throw new Error(`FTP create directory failed: ${error.message}`);
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

    const ftpClient = new FTPClient(config);
    let result;
    
    try {
      await ftpClient.connect();
      
      switch (action) {
        case 'test_connection':
          result = { success: true, message: "FTP connection successful" };
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
