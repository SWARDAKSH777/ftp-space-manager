
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

    const { action, serverId, path, config } = await req.json()
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
        }

        return new Response(JSON.stringify(connectionResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'list_files':
        const files = await listFiles(serverConfig, path || '/')
        
        // Cache the files
        if (serverId && files.success) {
          await cacheFiles(supabase, serverId, files.files)
        }

        return new Response(JSON.stringify(files), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'upload_file':
        // This would be implemented with actual FTP library
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Upload functionality will be implemented with FTP library' 
        }), {
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
  // Mock implementation - in production, use actual FTP library
  console.log(`Testing connection to ${config.host}:${config.port} with user ${config.username}`)
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // For demo purposes, randomly succeed/fail
  const success = Math.random() > 0.3
  
  return {
    success,
    error: success ? undefined : 'Connection failed: Unable to connect to FTP server'
  }
}

async function listFiles(config: FtpConnectionConfig, path: string): Promise<{ success: boolean; files: FtpFile[]; error?: string }> {
  // Mock implementation - in production, use actual FTP library
  console.log(`Listing files in ${path} on ${config.host}`)
  
  // Simulate file listing
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Mock file data
  const mockFiles: FtpFile[] = [
    {
      name: '..',
      size: 0,
      type: 'directory',
      modified_at: new Date().toISOString(),
      path: path === '/' ? '/' : path.split('/').slice(0, -1).join('/') || '/'
    },
    {
      name: 'documents',
      size: 0,
      type: 'directory',
      modified_at: new Date(Date.now() - 86400000).toISOString(),
      path: `${path}/documents`.replace('//', '/')
    },
    {
      name: 'uploads',
      size: 0,
      type: 'directory',
      modified_at: new Date(Date.now() - 172800000).toISOString(),
      path: `${path}/uploads`.replace('//', '/')
    },
    {
      name: 'readme.txt',
      size: 1024,
      type: 'file',
      modified_at: new Date(Date.now() - 86400000).toISOString(),
      path: `${path}/readme.txt`.replace('//', '/')
    },
    {
      name: 'config.json',
      size: 512,
      type: 'file',
      modified_at: new Date(Date.now() - 259200000).toISOString(),
      path: `${path}/config.json`.replace('//', '/')
    }
  ]
  
  return {
    success: true,
    files: mockFiles
  }
}

async function cacheFiles(supabase: any, serverId: string, files: FtpFile[]) {
  // Clear existing cache for this path
  // await supabase.from('file_cache').delete().eq('server_id', serverId)
  
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
  
  await supabase.from('file_cache').upsert(cacheEntries)
}
