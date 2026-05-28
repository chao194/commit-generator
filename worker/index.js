const UPSTREAM = 'https://ffkhfyzdmv.coze.site'
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFjMTRmNzk4LTM5YzQtNGNmOC1hOGQ5LWJiNDhmZGM5N2EzNCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIk9ZNWdjTkRDUUEyYndEbjNzc0ExWERiUTNWQ1JrR1ZiIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzc5OTM2MTE3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjM5NTYxMzAyMjA1MDA1ODMzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjQ0NzY3NDEzNTIyNjYxMzgyIn0.uUwDBa_k6atbTDGkbUOrKRF-8JdcC3Ekk30FWI4nt5-C_vMH19lUzKtH4jKmsRAPXJPZz1MWbytH1PMxQWl5P9ykKTuiBCcsik1D2FQVZxb1dZ4RSPITTU6g_CBSiwaGgyFw1Xrz4-F2RN7qoUzOFkQj0z68BHaAZrJYmenFvG29dV-w74y64a9E4RfkMqSmwfMASG-ocOIaKcqi0isDgKK-X_FwUvtIqRBg4JOt61aErlQfQ4Z_lW98mjmnkUB4_XsHlWcx6ZQMb_K30YRh9O6XJqCAS5yGHsRnhES3mbp345aDB_Lujd33r167_rl8J4Mp7QDFFNz59R5UjF3t_A'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 代理 /api/coze/* 请求到上游 Coze 服务
    if (url.pathname.startsWith('/api/coze/')) {
      const upstreamUrl = UPSTREAM + url.pathname.replace(/^\/api\/coze/, '')

      const headers = new Headers()
      headers.set('Authorization', `Bearer ${TOKEN}`)
      headers.set('Content-Type', 'application/json')

      const res = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method === 'POST' ? request.body : undefined,
      })

      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 其他请求回退到静态资源
    return env.ASSETS.fetch(request)
  },
}
