const API_URL = '/api/coze/stream_run'

export async function generateCommitMessage(prompt, { onToken, onDone, onError }) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
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
