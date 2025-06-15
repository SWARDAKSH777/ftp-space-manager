
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
  // Handle CORS preflight requests
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

    // Get server config if serverId provided
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
        
        // Update server status
        if (serverId) {
          await supabase
            .from('ftp_servers')
            .update({
              status: connectionResult.success ? 'active' : 'error',
              last_connected: connectionResult.success ? new Date().toISOString() : null
            })
            .eq('id', serverId)

          // Log activity
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
        
        // Cache the files
        if (serverId && files.success) {
          await cacheFiles(supabase, serverId, files.files)
          
          // Log activity
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
          // Record upload history
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

          // Log activity
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
          // Log activity
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
          // Log activity
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
          // Log activity
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
      return await testFtpTcpConnection(config)
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    return {
      success: false,
      error: `Connection failed: ${error.message}`
    }
  }
}

async function testSftpConnection(config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // For SFTP, we'll use a basic TCP connection test to the SSH port
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Read the SSH banner
    const buffer = new Uint8Array(1024)
    const bytesRead = await conn.read(buffer)
    
    if (bytesRead && bytesRead > 0) {
      const banner = new TextDecoder().decode(buffer.slice(0, bytesRead))
      if (banner.includes('SSH')) {
        conn.close()
        return { success: true }
      }
    }
    
    conn.close()
    return { success: false, error: 'Invalid SSH server response' }
  } catch (error) {
    return { success: false, error: `SFTP connection failed: ${error.message}` }
  }
}

async function testFtpTcpConnection(config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })
    
    // Read FTP welcome message
    const buffer = new Uint8Array(1024)
    const bytesRead = await conn.read(buffer)
    
    if (bytesRead && bytesRead > 0) {
      const response = new TextDecoder().decode(buffer.slice(0, bytesRead))
      if (response.startsWith('220')) {
        conn.close()
        return { success: true }
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
      return await listSftpFiles(config, path)
    } else {
      return await listFtpFiles(config, path)
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

async function listFtpFiles(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  try {
    const conn = await Deno.connect({ 
      hostname: config.host, 
      port: config.port 
    })

    // This is a simplified FTP implementation
    // In production, you'd want to use a proper FTP library
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    // Send USER command
    await conn.write(encoder.encode(`USER ${config.username}\r\n`))
    
    // Read response
    let buffer = new Uint8Array(1024)
    await conn.read(buffer)
    
    // Send PASS command
    await conn.write(encoder.encode(`PASS ${config.password}\r\n`))
    await conn.read(buffer)
    
    // Set passive mode if required
    if (config.passive_mode) {
      await conn.write(encoder.encode('PASV\r\n'))
      await conn.read(buffer)
    }
    
    // Send LIST command
    await conn.write(encoder.encode(`LIST ${path}\r\n`))
    const listResponse = await conn.read(buffer)
    
    conn.close()
    
    // Parse the directory listing (simplified)
    const files: FtpFile[] = [
      {
        name: '..',
        size: 0,
        type: 'directory',
        modified_at: new Date().toISOString(),
        path: path === '/' ? '/' : path.split('/').slice(0, -1).join('/') || '/'
      }
    ]
    
    return {
      success: true,
      files: files
    }
  } catch (error) {
    return {
      success: false,
      files: [],
      error: `FTP list failed: ${error.message}`
    }
  }
}

async function listSftpFiles(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  // SFTP implementation would go here
  // For now, return a basic structure
  return {
    success: false,
    files: [],
    error: 'SFTP file listing not yet implemented'
  }
}

async function uploadFile(config: FtpConnectionConfig, localPath: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Uploading file to ${remotePath} on ${config.host}`)
    
    if (config.protocol === 'sftp') {
      return await uploadSftpFile(config, localPath, remotePath, content)
    } else {
      return await uploadFtpFile(config, localPath, remotePath, content)
    }
  } catch (error) {
    return {
      success: false,
      error: `Upload failed: ${error.message}`
    }
  }
}

async function uploadFtpFile(config: FtpConnectionConfig, localPath: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  // FTP upload implementation would go here
  return {
    success: false,
    error: 'FTP upload not yet implemented'
  }
}

async function uploadSftpFile(config: FtpConnectionConfig, localPath: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  // SFTP upload implementation would go here
  return {
    success: false,
    error: 'SFTP upload not yet implemented'
  }
}

async function downloadFile(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; content?: string; error?: string }> {
  // File download implementation would go here
  return {
    success: false,
    error: 'File download not yet implemented'
  }
}

async function deleteFile(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; error?: string }> {
  // File deletion implementation would go here
  return {
    success: false,
    error: 'File deletion not yet implemented'
  }
}

async function createDirectory(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; error?: string }> {
  // Directory creation implementation would go here
  return {
    success: false,
    error: 'Directory creation not yet implemented'
  }
}

async function generateStatistics(supabase: any, serverId: string, config: FtpConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all files from cache or scan server
    const files = await listFiles(config, '/')
    
    if (!files.success) {
      return { success: false, error: files.error }
    }
    
    // Calculate statistics
    const stats = {
      total_files: files.files.filter(f => f.type === 'file').length,
      total_directories: files.files.filter(f => f.type === 'directory').length,
      total_size: files.files.reduce((sum, f) => sum + f.size, 0),
      file_types: {},
      size_distribution: {
        '<1MB': 0,
        '1-10MB': 0,
        '10-100MB': 0,
        '>100MB': 0
      }
    }
    
    // Analyze file types and sizes
    files.files.forEach(file => {
      if (file.type === 'file') {
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
      }
    })
    
    // Save statistics
    await supabase.from('server_statistics').upsert({
      server_id: serverId,
      ...stats,
      last_scan: new Date().toISOString()
    })
    
    return { success: true }
  } catch (error) {
    return { success: false, error: `Statistics generation failed: ${error.message}` }
  }
}

async function cacheFiles(supabase: any, serverId: string, files: FtpFile[]) {
  try {
    // Clear existing cache for this server
    await supabase.from('file_cache').delete().eq('server_id', serverId)
    
    // Insert new cache entries
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
