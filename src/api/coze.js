const API_URL = '/api/coze/stream_run'
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFjMTRmNzk4LTM5YzQtNGNmOC1hOGQ5LWJiNDhmZGM5N2EzNCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIk9ZNWdjTkRDUUEyYndEbjNzc0ExWERiUTNWQ1JrR1ZiIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzc5OTM2MTE3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjM5NTYxMzAyMjA1MDA1ODMzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjQ0NzY3NDEzNTIyNjYxMzgyIn0.uUwDBa_k6atbTDGkbUOrKRF-8JdcC3Ekk30FWI4nt5-C_vMH19lUzKtH4jKmsRAPXJPZz1MWbytH1PMxQWl5P9ykKTuiBCcsik1D2FQVZxb1dZ4RSPITTU6g_CBSiwaGgyFw1Xrz4-F2RN7qoUzOFkQj0z68BHaAZrJYmenFvG29dV-w74y64a9E4RfkMqSmwfMASG-ocOIaKcqi0isDgKK-X_FwUvtIqRBg4JOt61aErlQfQ4Z_lW98mjmnkUB4_XsHlWcx6ZQMb_K30YRh9O6XJqCAS5yGHsRnhES3mbp345aDB_Lujd33r167_rl8J4Mp7QDFFNz59R5UjF3t_A'

export async function generateCommitMessage(prompt, { onToken, onDone, onError }) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        content: {
          query: {
            prompt: [{ type: 'text', content: { text: prompt } }],
          },
        },
        type: 'query',
        session_id: 'f4ZaKDJUzLTOZgLnIaxZ6',
        project_id: '7639559149717602331',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      onError?.(`请求失败 (${res.status}): ${errText}`)
      return
    }

    if (!res.body) {
      onError?.('无响应内容')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        // 解析 SSE 块：提取 data 行
        const dataText = block
          .split('\n')
          .find((line) => line.startsWith('data:'))
          ?.slice(5)
          .trim() || ''

        if (!dataText) continue

        try {
          const parsed = JSON.parse(dataText)

          // 新格式：type 字段标识消息类型
          if (parsed.type === 'message_end') {
            onDone?.(parsed)
            return
          }

          if (parsed.type === 'error' || parsed.content?.error) {
            onError?.(parsed.content?.error?.message || parsed.message || '生成失败')
            return
          }

          // answer 类型：提取 content.answer
          if (parsed.type === 'answer' && parsed.content?.answer) {
            onToken?.(parsed.content.answer)
          }

          // finish 标记也表示结束
          if (parsed.type === 'answer' && parsed.finish) {
            onDone?.(parsed)
            return
          }
        } catch {
          if (dataText.trim()) {
            onToken?.(dataText)
          }
        }
      }
    }

    onDone?.()
  } catch (err) {
    onError?.(err.message || '网络错误')
  }
}
