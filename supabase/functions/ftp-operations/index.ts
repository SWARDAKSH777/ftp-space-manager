
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FtpConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  passive_mode: boolean;
}

interface FtpFile {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified_at: string;
  path: string;
  permissions?: string;
  owner?: string;
  group?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    )

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, serverId, path, config, fileData } = await req.json()
    console.log(`FTP operation: ${action} for user ${user.id}`)

    let serverConfig: FtpConnectionConfig | null = null
    if (serverId) {
      const { data: server } = await supabase
        .from('ftp_servers')
        .select('*')
        .eq('id', serverId)
        .eq('user_id', user.id)
        .single()

      if (!server) {
        return new Response(JSON.stringify({ error: 'Server not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      serverConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        protocol: server.protocol,
        passive_mode: server.passive_mode
      }
    } else if (config) {
      serverConfig = config
    }

    if (!serverConfig) {
      return new Response(JSON.stringify({ error: 'No server configuration provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'test_connection':
        const connectionResult = await testFtpConnection(serverConfig)
        
        if (serverId) {
          await supabase
            .from('ftp_servers')
            .update({
              status: connectionResult.success ? 'active' : 'error',
              last_connected: connectionResult.success ? new Date().toISOString() : null
            })
            .eq('id', serverId)

          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'connection_test',
            details: { result: connectionResult.success ? 'success' : 'failed', error: connectionResult.error }
          })
        }

        return new Response(JSON.stringify(connectionResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'list_files':
        const files = await listFiles(serverConfig, path || '/')
        
        if (serverId && files.success) {
          await cacheFiles(supabase, serverId, files.files)
          
          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'list_files',
            details: { path: path || '/', file_count: files.files.length }
          })
        }

        return new Response(JSON.stringify(files), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'upload_file':
        const uploadResult = await uploadFile(serverConfig, fileData.localPath, fileData.remotePath, fileData.content)
        
        if (serverId) {
          await supabase.from('upload_history').insert({
            server_id: serverId,
            file_name: fileData.fileName,
            file_size: fileData.size,
            local_path: fileData.localPath,
            remote_path: fileData.remotePath,
            status: uploadResult.success ? 'completed' : 'failed',
            started_at: new Date().toISOString(),
            completed_at: uploadResult.success ? new Date().toISOString() : null,
            error_message: uploadResult.error || null
          })

          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'upload_file',
            details: { 
              file_name: fileData.fileName,
              remote_path: fileData.remotePath,
              result: uploadResult.success ? 'success' : 'failed',
              error: uploadResult.error
            }
          })
        }

        return new Response(JSON.stringify(uploadResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'download_file':
        const downloadResult = await downloadFile(serverConfig, path)
        
        if (serverId) {
          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'download_file',
            details: { 
              file_path: path,
              result: downloadResult.success ? 'success' : 'failed',
              error: downloadResult.error
            }
          })
        }

        return new Response(JSON.stringify(downloadResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'delete_file':
        const deleteResult = await deleteFile(serverConfig, path)
        
        if (serverId) {
          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'delete_file',
            details: { 
              file_path: path,
              result: deleteResult.success ? 'success' : 'failed',
              error: deleteResult.error
            }
          })
        }

        return new Response(JSON.stringify(deleteResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'create_directory':
        const createDirResult = await createDirectory(serverConfig, path)
        
        if (serverId) {
          await supabase.from('activity_log').insert({
            user_id: user.id,
            server_id: serverId,
            action: 'create_directory',
            details: { 
              directory_path: path,
              result: createDirResult.success ? 'success' : 'failed',
              error: createDirResult.error
            }
          })
        }

        return new Response(JSON.stringify(createDirResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'generate_statistics':
        const statsResult = await generateStatistics(supabase, serverId, serverConfig)
        
        return new Response(JSON.stringify(statsResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('FTP operation error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function testFtpConnection(config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Testing ${config.protocol.toUpperCase()} connection to ${config.host}:${config.port}`)
    
    if (config.protocol === 'sftp') {
      return await testSftpConnection(config)
    } else {
      return await testFtpPlainConnection(config)
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    return { success: false, error: `Connection failed: ${error.message}` }
  }
}

async function testSftpConnection(config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    const buffer = new Uint8Array(1024)
    const bytesRead = await conn.read(buffer)
    
    if (bytesRead && bytesRead > 0) {
      const response = new TextDecoder().decode(buffer.slice(0, bytesRead))
      console.log('SFTP Response:', response)
      
      if (response.includes('SSH-2.0') || response.includes('SSH')) {
        conn.close()
        return { success: true }
      }
    }
    
    conn.close()
    return { success: false, error: 'Invalid SFTP server response' }
  } catch (error) {
    return { success: false, error: `SFTP connection failed: ${error.message}` }
  }
}

async function testFtpPlainConnection(config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    const buffer = new Uint8Array(1024)
    const bytesRead = await conn.read(buffer)
    
    if (bytesRead && bytesRead > 0) {
      const response = new TextDecoder().decode(buffer.slice(0, bytesRead))
      console.log('FTP Response:', response)
      
      if (response.startsWith('220')) {
        // Send USER command
        const userCmd = `USER ${config.username}\r\n`
        await conn.write(new TextEncoder().encode(userCmd))
        
        const userResponse = new Uint8Array(1024)
        const userBytesRead = await conn.read(userResponse)
        const userResponseText = new TextDecoder().decode(userResponse.slice(0, userBytesRead || 0))
        console.log('USER Response:', userResponseText)
        
        if (userResponseText.startsWith('331')) {
          // Send PASS command
          const passCmd = `PASS ${config.password}\r\n`
          await conn.write(new TextEncoder().encode(passCmd))
          
          const passResponse = new Uint8Array(1024)
          const passBytesRead = await conn.read(passResponse)
          const passResponseText = new TextDecoder().decode(passResponse.slice(0, passBytesRead || 0))
          console.log('PASS Response:', passResponseText)
          
          conn.close()
          
          if (passResponseText.startsWith('230')) {
            return { success: true }
          } else {
            return { success: false, error: 'Authentication failed' }
          }
        }
      }
    }
    
    conn.close()
    return { success: false, error: 'Invalid FTP server response' }
  } catch (error) {
    return { success: false, error: `FTP connection failed: ${error.message}` }
  }
}

async function listFiles(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  try {
    console.log(`Listing files in ${path} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return await listFilesSftp(config, path)
    } else {
      return await listFilesFtp(config, path)
    }
  } catch (error) {
    console.error('List files failed:', error)
    return {
      success: false,
      files: [],
      error: `Failed to list files: ${error.message}`
    }
  }
}

async function listFilesFtp(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  let conn: Deno.TcpConn | null = null
  let dataConn: Deno.TcpConn | null = null
  
  try {
    conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Authenticate first
    const authResult = await authenticateFtp(conn, config)
    if (!authResult.success) {
      return { success: false, files: [], error: authResult.error }
    }
    
    // Set binary mode
    await conn.write(new TextEncoder().encode('TYPE I\r\n'))
    await readFtpResponse(conn)
    
    // For active mode, use PORT command instead of PASV
    if (!config.passive_mode) {
      // Use active mode - create server socket and send PORT command
      const listener = Deno.listen({ port: 0 })
      const localAddr = listener.addr as Deno.NetAddr
      const portBytes = [(localAddr.port >> 8) & 0xFF, localAddr.port & 0xFF]
      
      // Get local IP (simplified - use localhost for now)
      const portCmd = `PORT 127,0,0,1,${portBytes[0]},${portBytes[1]}\r\n`
      await conn.write(new TextEncoder().encode(portCmd))
      const portResponse = await readFtpResponse(conn)
      console.log('PORT Response:', portResponse)
      
      // Send LIST command
      const listCmd = `LIST ${path}\r\n`
      await conn.write(new TextEncoder().encode(listCmd))
      
      // Accept data connection
      dataConn = await listener.accept()
      listener.close()
      
      // Read LIST response from control connection
      const listResponse = await readFtpResponse(conn)
      console.log('LIST Response:', listResponse)
      
      // Read file data from data connection
      const fileData = await readAllData(dataConn)
      const fileListText = new TextDecoder().decode(fileData)
      console.log('File list data:', fileListText)
      
      dataConn.close()
      
      // Parse the file list
      const files = parseListResponse(fileListText, path)
      
      return {
        success: true,
        files: files
      }
    } else {
      // Try passive mode with better error handling
      await conn.write(new TextEncoder().encode('PASV\r\n'))
      const pasvResponse = await readFtpResponse(conn)
      console.log('PASV Response:', pasvResponse)
      
      if (!pasvResponse.startsWith('227')) {
        return { success: false, files: [], error: 'PASV command failed' }
      }
      
      // Parse PASV response to get data port
      const pasvMatch = pasvResponse.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/)
      if (!pasvMatch) {
        return { success: false, files: [], error: 'Could not parse PASV response' }
      }
      
      const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`
      const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6])
      
      console.log(`Connecting to data port: ${dataHost}:${dataPort}`)
      
      try {
        // Connect to data port with timeout
        dataConn = await Promise.race([
          Deno.connect({ hostname: dataHost, port: dataPort }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Data connection timeout')), 5000)
          )
        ])
      } catch (error) {
        console.error('Data connection failed:', error)
        return { success: false, files: [], error: 'Data connection failed - server may not support passive mode from this network' }
      }
      
      // Send LIST command
      const listCmd = `LIST ${path}\r\n`
      await conn.write(new TextEncoder().encode(listCmd))
      
      // Read file data from data connection
      const fileData = await readAllData(dataConn)
      const fileListText = new TextDecoder().decode(fileData)
      console.log('File list data:', fileListText)
      
      dataConn.close()
      
      // Read LIST response from control connection
      const listResponse = await readFtpResponse(conn)
      console.log('LIST Response:', listResponse)
      
      // Parse the file list
      const files = parseListResponse(fileListText, path)
      
      return {
        success: true,
        files: files
      }
    }
  } catch (error) {
    console.error('FTP LIST failed:', error)
    return {
      success: false,
      files: [],
      error: `FTP list failed: ${error.message}`
    }
  } finally {
    if (dataConn) {
      try { dataConn.close() } catch {}
    }
    if (conn) {
      try { conn.close() } catch {}
    }
  }
}

async function readAllData(conn: Deno.TcpConn): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  const buffer = new Uint8Array(4096)
  
  try {
    while (true) {
      const bytesRead = await conn.read(buffer)
      if (!bytesRead || bytesRead === 0) break
      
      chunks.push(buffer.slice(0, bytesRead))
    }
  } catch (error) {
    // Connection closed, which is expected
  }
  
  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  
  return result
}

async function listFilesSftp(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  // SFTP implementation would require SSH2 protocol handling
  // For now, return error indicating SFTP needs additional setup
  return {
    success: false,
    files: [],
    error: 'SFTP file listing requires SSH2 protocol implementation. Please use FTP for now.'
  }
}

async function authenticateFtp(conn: Deno.TcpConn, config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // Read welcome message
    await readFtpResponse(conn)
    
    // Send USER command
    const userCmd = `USER ${config.username}\r\n`
    await conn.write(new TextEncoder().encode(userCmd))
    
    const userResponse = await readFtpResponse(conn)
    if (!userResponse.startsWith('331')) {
      return { success: false, error: 'User command failed' }
    }
    
    // Send PASS command
    const passCmd = `PASS ${config.password}\r\n`
    await conn.write(new TextEncoder().encode(passCmd))
    
    const passResponse = await readFtpResponse(conn)
    if (!passResponse.startsWith('230')) {
      return { success: false, error: 'Authentication failed' }
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: `Authentication failed: ${error.message}` }
  }
}

async function readFtpResponse(conn: Deno.TcpConn): Promise<string> {
  const buffer = new Uint8Array(1024)
  const bytesRead = await conn.read(buffer)
  return new TextDecoder().decode(buffer.slice(0, bytesRead || 0))
}

function parseListResponse(response: string, basePath: string): FtpFile[] {
  const files: FtpFile[] = []
  const lines = response.split('\n').filter(line => line.trim())
  
  // Add parent directory if not root
  if (basePath !== '/') {
    files.push({
      name: '..',
      size: 0,
      type: 'directory',
      modified_at: new Date().toISOString(),
      path: basePath.split('/').slice(0, -1).join('/') || '/'
    })
  }
  
  for (const line of lines) {
    if (line.includes('150 ') || line.includes('226 ') || line.includes('total ')) {
      continue // Skip command responses
    }
    
    // Parse Unix-style listing (most common)
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 9) {
      const permissions = parts[0]
      const size = parseInt(parts[4]) || 0
      const name = parts.slice(8).join(' ')
      
      if (name && name !== '.' && name !== '..') {
        files.push({
          name: name,
          size: size,
          type: permissions.startsWith('d') ? 'directory' : 'file',
          modified_at: new Date().toISOString(),
          path: `${basePath}/${name}`.replace('//', '/'),
          permissions: permissions
        })
      }
    }
  }
  
  return files
}

async function uploadFile(config: FtpConnectionConfig, localPath: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.TcpConn | null = null
  let dataConn: Deno.TcpConn | null = null
  
  try {
    console.log(`Uploading file to ${remotePath} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return { success: false, error: 'SFTP upload requires SSH2 protocol implementation. Please use FTP for now.' }
    }
    
    conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Authenticate
    const authResult = await authenticateFtp(conn, config)
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    
    // Set binary mode
    await conn.write(new TextEncoder().encode('TYPE I\r\n'))
    await readFtpResponse(conn)
    
    // Use active mode for upload
    const listener = Deno.listen({ port: 0 })
    const localAddr = listener.addr as Deno.NetAddr
    const portBytes = [(localAddr.port >> 8) & 0xFF, localAddr.port & 0xFF]
    
    const portCmd = `PORT 127,0,0,1,${portBytes[0]},${portBytes[1]}\r\n`
    await conn.write(new TextEncoder().encode(portCmd))
    const portResponse = await readFtpResponse(conn)
    console.log('PORT Response:', portResponse)
    
    // Send STOR command
    const storCmd = `STOR ${remotePath}\r\n`
    await conn.write(new TextEncoder().encode(storCmd))
    
    // Accept data connection
    dataConn = await listener.accept()
    listener.close()
    
    // Write file content to data connection
    const fileBytes = new TextEncoder().encode(atob(content))
    await dataConn.write(fileBytes)
    dataConn.close()
    
    // Read STOR response
    const storResponse = await readFtpResponse(conn)
    console.log('STOR Response:', storResponse)
    
    if (storResponse.startsWith('226') || storResponse.startsWith('250')) {
      return { success: true }
    } else {
      return { success: false, error: 'Upload failed - ' + storResponse }
    }
  } catch (error) {
    console.error('Upload failed:', error)
    return {
      success: false,
      error: `Upload failed: ${error.message}`
    }
  } finally {
    if (dataConn) {
      try { dataConn.close() } catch {}
    }
    if (conn) {
      try { conn.close() } catch {}
    }
  }
}

async function downloadFile(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; content?: string; error?: string }> {
  let conn: Deno.TcpConn | null = null
  let dataConn: Deno.TcpConn | null = null
  
  try {
    console.log(`Downloading file from ${path} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return { success: false, error: 'SFTP download requires SSH2 protocol implementation. Please use FTP for now.' }
    }
    
    conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Authenticate
    const authResult = await authenticateFtp(conn, config)
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    
    // Set binary mode
    await conn.write(new TextEncoder().encode('TYPE I\r\n'))
    await readFtpResponse(conn)
    
    // Use active mode for download
    const listener = Deno.listen({ port: 0 })
    const localAddr = listener.addr as Deno.NetAddr
    const portBytes = [(localAddr.port >> 8) & 0xFF, localAddr.port & 0xFF]
    
    const portCmd = `PORT 127,0,0,1,${portBytes[0]},${portBytes[1]}\r\n`
    await conn.write(new TextEncoder().encode(portCmd))
    const portResponse = await readFtpResponse(conn)
    console.log('PORT Response:', portResponse)
    
    // Send RETR command
    const retrCmd = `RETR ${path}\r\n`
    await conn.write(new TextEncoder().encode(retrCmd))
    
    // Accept data connection
    dataConn = await listener.accept()
    listener.close()
    
    // Read file content from data connection
    const fileData = await readAllData(dataConn)
    dataConn.close()
    
    // Read RETR response
    const retrResponse = await readFtpResponse(conn)
    console.log('RETR Response:', retrResponse)
    
    if (retrResponse.startsWith('226') || retrResponse.startsWith('250')) {
      return {
        success: true,
        content: btoa(new TextDecoder().decode(fileData))
      }
    } else {
      return { success: false, error: 'Download failed - ' + retrResponse }
    }
  } catch (error) {
    console.error('Download failed:', error)
    return {
      success: false,
      error: `Download failed: ${error.message}`
    }
  } finally {
    if (dataConn) {
      try { dataConn.close() } catch {}
    }
    if (conn) {
      try { conn.close() } catch {}
    }
  }
}

async function deleteFile(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Deleting file at ${path} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return { success: false, error: 'SFTP delete requires SSH2 protocol implementation. Please use FTP for now.' }
    }
    
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Authenticate
    const authResult = await authenticateFtp(conn, config)
    if (!authResult.success) {
      conn.close()
      return { success: false, error: authResult.error }
    }
    
    // Send DELE command
    const deleCmd = `DELE ${path}\r\n`
    await conn.write(new TextEncoder().encode(deleCmd))
    
    const deleResponse = await readFtpResponse(conn)
    console.log('DELE Response:', deleResponse)
    
    conn.close()
    
    if (deleResponse.startsWith('250')) {
      return { success: true }
    } else {
      return { success: false, error: 'Delete command failed' }
    }
  } catch (error) {
    console.error('Delete failed:', error)
    return {
      success: false,
      error: `Delete failed: ${error.message}`
    }
  }
}

async function createDirectory(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Creating directory at ${path} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return { success: false, error: 'SFTP mkdir requires SSH2 protocol implementation. Please use FTP for now.' }
    }
    
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Authenticate
    const authResult = await authenticateFtp(conn, config)
    if (!authResult.success) {
      conn.close()
      return { success: false, error: authResult.error }
    }
    
    // Send MKD command
    const mkdCmd = `MKD ${path}\r\n`
    await conn.write(new TextEncoder().encode(mkdCmd))
    
    const mkdResponse = await readFtpResponse(conn)
    console.log('MKD Response:', mkdResponse)
    
    conn.close()
    
    if (mkdResponse.startsWith('257')) {
      return { success: true }
    } else {
      return { success: false, error: 'Directory creation failed' }
    }
  } catch (error) {
    console.error('Create directory failed:', error)
    return {
      success: false,
      error: `Directory creation failed: ${error.message}`
    }
  }
}

async function generateStatistics(supabase: any, serverId: string, config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const files = await listFiles(config, '/')
    
    if (!files.success) {
      return { success: false, error: files.error }
    }
    
    const fileStats = files.files.filter(f => f.type === 'file')
    const dirStats = files.files.filter(f => f.type === 'directory')
    
    const stats = {
      total_files: fileStats.length,
      total_directories: dirStats.length,
      total_size: fileStats.reduce((sum, f) => sum + f.size, 0),
      file_types: {} as Record<string, number>,
      size_distribution: {
        '<1MB': 0,
        '1-10MB': 0,
        '10-100MB': 0,
        '>100MB': 0
      }
    }
    
    fileStats.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      stats.file_types[ext] = (stats.file_types[ext] || 0) + 1
      
      if (file.size < 1024 * 1024) {
        stats.size_distribution['<1MB']++
      } else if (file.size < 10 * 1024 * 1024) {
        stats.size_distribution['1-10MB']++
      } else if (file.size < 100 * 1024 * 1024) {
        stats.size_distribution['10-100MB']++
      } else {
        stats.size_distribution['>100MB']++
      }
    })
    
    await supabase.from('server_statistics').upsert({
      server_id: serverId,
      ...stats,
      last_scan: new Date().toISOString()
    })
    
    return { success: true }
  } catch (error) {
    console.error('Statistics generation failed:', error)
    return { success: false, error: `Statistics generation failed: ${error.message}` }
  }
}

async function cacheFiles(supabase: any, serverId: string, files: FtpFile[]) {
  try {
    await supabase.from('file_cache').delete().eq('server_id', serverId)
    
    const cacheEntries = files.map(file => ({
      server_id: serverId,
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
      modified_at: file.modified_at,
      cached_at: new Date().toISOString()
    }))
    
    if (cacheEntries.length > 0) {
      await supabase.from('file_cache').insert(cacheEntries)
    }
  } catch (error) {
    console.error('Failed to cache files:', error)
  }
}
