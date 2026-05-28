<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { generateCommitMessage } from '../api/coze.js'

// --- 对话历史持久化 ---
const STORAGE_KEY = 'commit-generator-history'

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// --- 状态 ---
const conversations = ref(loadHistory())
const activeId = ref(null)
const inputText = ref('')
const streaming = ref(false)
const sidebarCollapsed = ref(false)

const activeConversation = computed(
  () => conversations.value.find((c) => c.id === activeId.value) || null
)

const messages = computed(() => activeConversation.value?.messages || [])

// --- 自动滚动 ---
const messagesContainer = ref(null)
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(messages, scrollToBottom, { deep: true })

// --- 持久化 ---
watch(conversations, (v) => saveHistory(v), { deep: true })

// --- 操作 ---
function newConversation() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  conversations.value.unshift({
    id,
    title: '新对话',
    createdAt: Date.now(),
    messages: [],
  })
  activeId.value = id
  inputText.value = ''
}

function selectConversation(id) {
  activeId.value = id
}

function deleteConversation(id, e) {
  e.stopPropagation()
  conversations.value = conversations.value.filter((c) => c.id !== id)
  if (activeId.value === id) {
    activeId.value = conversations.value[0]?.id || null
  }
}

function clearAll() {
  conversations.value = []
  activeId.value = null
}

function sendQuickMessage(text) {
  if (!activeId.value) newConversation()
  inputText.value = text
  sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  if (!activeId.value) newConversation()

  const conv = conversations.value.find((c) => c.id === activeId.value)
  if (!conv) return

  // 设置对话标题
  if (conv.messages.length === 0) {
    conv.title = text.slice(0, 30) + (text.length > 30 ? '...' : '')
  }

  // 添加用户消息
  conv.messages.push({ role: 'user', content: text, time: Date.now() })
  inputText.value = ''

  // 添加助手消息占位
  const assistantMsg = {
    role: 'assistant',
    content: '',
    time: Date.now(),
    done: false,
  }
  conv.messages.push(assistantMsg)
  streaming.value = true
  await scrollToBottom()

  generateCommitMessage(text, {
    onToken(token) {
      assistantMsg.content += token
    },
    onDone() {
      assistantMsg.done = true
      streaming.value = false
      saveHistory(conversations.value)
    },
    onError(err) {
      assistantMsg.content += `\n\n错误: ${err}`
      assistantMsg.done = true
      streaming.value = false
    },
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function cleanCodeBlock(text) {
  return text
    .replace(/^```\w*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

function copyText(text) {
  const clean = cleanCodeBlock(text)
  navigator.clipboard.writeText(clean).then(() => {
    ElMessage({ message: '已复制到剪贴板', type: 'success', duration: 1500 })
  })
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  if (d.toDateString() === now.toDateString()) return time

  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

// --- 初始化 ---
onMounted(() => {
  if (conversations.value.length > 0) {
    activeId.value = conversations.value[0].id
  }
})
</script>

<template>
  <div class="bg-animation">
    <div class="orb"></div>
    <div class="orb"></div>
    <div class="orb"></div>
  </div>

  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo-area" v-show="!sidebarCollapsed">
          <div class="logo-icon">
            <img src="/favicon.svg" alt="logo" />
          </div>
          <span class="logo-text">Commit Generator</span>
        </div>
        <button
          class="toggle-btn"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <el-icon :size="18">
            <DArrowLeft v-if="!sidebarCollapsed" />
            <DArrowRight v-else />
          </el-icon>
        </button>
      </div>

      <div class="sidebar-actions" v-show="!sidebarCollapsed">
        <button class="new-chat-btn" @click="newConversation">
          <el-icon><Plus /></el-icon>
          <span>新建对话</span>
        </button>
      </div>

      <div class="conversation-list" v-show="!sidebarCollapsed">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === activeId }"
          @click="selectConversation(conv.id)"
        >
          <el-icon class="conv-icon"><ChatDotRound /></el-icon>
          <span class="conv-title">{{ conv.title }}</span>
          <button
            class="conv-delete"
            @click="deleteConversation(conv.id, $event)"
          >
            <el-icon :size="14"><Close /></el-icon>
          </button>
        </div>

        <div v-if="conversations.length === 0" class="empty-hint">
          <el-icon :size="32"><ChatLineRound /></el-icon>
          <p>暂无对话记录</p>
        </div>
      </div>

      <div class="sidebar-footer" v-show="!sidebarCollapsed">
        <button
          class="clear-btn"
          @click="clearAll"
          v-if="conversations.length > 0"
        >
          <el-icon><Delete /></el-icon>
          <span>清除全部</span>
        </button>
      </div>
    </aside>

    <!-- 主区域 -->
    <main class="main-area">
      <!-- 空状态 -->
      <div
        v-if="!activeConversation || messages.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            width="64"
            height="64"
          >
            <path
              d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a9 9 0 0 1-9 9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1>Git Commit 生成器</h1>
        <p>输入你的代码变更描述，AI 为你生成规范的 commit message</p>
        <div class="suggestions">
          <button
            class="suggestion-chip"
            @click="sendQuickMessage('修复用户登录时 token 过期未刷新的 bug')"
          >
            修复登录 token 刷新 bug
          </button>
          <button
            class="suggestion-chip"
            @click="
              sendQuickMessage('新增订单导出 CSV 功能，支持按日期范围筛选')
            "
          >
            新增订单导出 CSV 功能
          </button>
          <button
            class="suggestion-chip"
            @click="
              sendQuickMessage('重构支付模块，拆分支付宝和微信支付为独立服务')
            "
          >
            重构支付模块
          </button>
        </div>
      </div>

      <!-- 对话区域 -->
      <template v-else>
        <div class="chat-header">
          <h2>{{ activeConversation.title }}</h2>
          <span class="msg-count">{{ messages.length }} 条消息</span>
        </div>

        <div class="messages-container" ref="messagesContainer">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message"
            :class="[
              msg.role,
              { streaming: msg.role === 'assistant' && !msg.done },
            ]"
          >
            <!-- 助手消息：头像在左 -->
            <template v-if="msg.role === 'assistant'">
              <div class="msg-avatar">
                <img src="/favicon.svg" alt="assistant" />
              </div>
              <div class="msg-body">
                <div class="msg-content assistant-msg">
                  <div
                    class="streaming-text"
                    v-html="formatContent(msg.content)"
                  ></div>
                  <span v-if="!msg.done" class="typing-cursor">
                    <span></span><span></span><span></span>
                  </span>
                </div>
                <div class="msg-actions" v-if="msg.done">
                  <button
                    class="action-btn"
                    @click="copyText(msg.content)"
                    title="复制"
                  >
                    <el-icon :size="14"><CopyDocument /></el-icon>
                  </button>
                </div>
                <span class="msg-time">{{ formatTime(msg.time) }}</span>
              </div>
            </template>
            <!-- 用户消息：头像在右 -->
            <template v-else>
              <div class="msg-body">
                <div class="msg-content">
                  <pre>{{ msg.content }}</pre>
                </div>
                <div class="msg-actions justify-end">
                  <button
                    class="action-btn"
                    @click="copyText(msg.content)"
                    title="复制"
                  >
                    <el-icon :size="14"><CopyDocument /></el-icon>
                  </button>
                </div>
                <span class="msg-time text-right">{{
                  formatTime(msg.time)
                }}</span>
              </div>
              <div class="msg-avatar">
                <el-icon :size="16"><User /></el-icon>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- 输入区域 -->
      <div
        class="input-area"
        :class="{
          'has-conversation': activeConversation && messages.length > 0,
        }"
      >
        <div class="input-wrapper">
          <el-input
            v-model="inputText"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="描述你的代码变更，例如：修复用户登录时 token 过期未刷新的 bug"
            @keydown="handleKeydown"
            :disabled="streaming"
          />
          <button
            class="send-btn"
            @click="sendMessage"
            :disabled="!inputText.trim() || streaming"
          >
            <el-icon :size="20"><Promotion /></el-icon>
          </button>
        </div>
        <p class="input-hint">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  methods: {
    formatContent(text) {
      if (!text) return ''
      let clean = text
      // 去掉开头的 ``` 和可选语言标识
      if (clean.startsWith('```')) {
        clean = clean.slice(3)
        const newlineIdx = clean.indexOf('\n')
        if (newlineIdx > 0 && /^[\w]*$/.test(clean.slice(0, newlineIdx))) {
          clean = clean.slice(newlineIdx + 1)
        } else if (clean.length === 0 || /^[\w]*$/.test(clean)) {
          clean = ''
        }
      }
      // 去掉结尾的 ```
      clean = clean.replace(/\n?```$/, '')
      // 去掉开头残留的换行
      clean = clean.replace(/^\n+/, '')
      // 转义 HTML
      let html = clean
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // 换行
      html = html.replace(/\n/g, '<br>')
      return html
    },
  },
}
</script>

<style scoped>
/* ===== 布局 ===== */
.app-layout {
  display: flex;
  height: 100vh;
  position: relative;
  z-index: 1;
}

/* ===== 侧边栏 ===== */
.sidebar {
  width: 280px;
  background: rgba(8, 8, 20, 0.7);
  backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 52px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-icon img {
  width: 20px;
  height: 20px;
}

.logo-text {
  font-weight: 600;
  font-size: 15px;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-3));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.sidebar-actions {
  padding: 12px 16px;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  color: var(--accent-1);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
  border-style: solid;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2px;
  border: 1px solid transparent;
}

.conv-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.04);
}

.conv-item.active {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.conv-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.conv-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item.active .conv-title {
  color: var(--text-primary);
}

.conv-delete {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.conv-item:hover .conv-delete {
  opacity: 1;
}

.conv-delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.empty-hint {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-hint p {
  margin-top: 8px;
  font-size: 13px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.clear-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  backdrop-filter: blur(8px);
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.12);
}

/* ===== 主区域 ===== */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ===== 空状态 ===== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-icon {
  color: var(--accent-1);
  margin-bottom: 20px;
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

.empty-state h1 {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-3));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 15px;
  margin-bottom: 32px;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 600px;
}

.suggestion-chip {
  padding: 10px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.suggestion-chip:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
}

/* ===== 对话头部 ===== */
.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(var(--glass-blur));
  background: rgba(8, 8, 20, 0.5);
}

.chat-header h2 {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.04);
  padding: 4px 10px;
  border-radius: 20px;
}

/* ===== 消息区 ===== */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: flex-start;
}

.message {
  display: flex;
  gap: 12px;
  animation: fadeInUp 0.3s ease-out;
  max-width: 85%;
}

.message.assistant {
  align-self: flex-start;
}

.message.user {
  align-self: flex-end;
  flex-direction: row;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .msg-avatar {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.message.assistant .msg-avatar {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.message.assistant .msg-avatar img {
  width: 18px;
  height: 18px;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-content {
  padding: 14px 18px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.7;
  backdrop-filter: blur(16px);
}

.message.user .msg-content {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.message.user .msg-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
}

.assistant-msg {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-left: 4px;
}

.msg-actions.justify-end {
  justify-content: flex-end;
  padding-right: 4px;
  padding-left: 0;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--accent-1);
}

.msg-time {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.5);
  margin-top: 6px;
  padding-left: 4px;
  display: block;
}

.msg-time.text-right {
  text-align: right;
  padding-right: 4px;
  padding-left: 0;
}

/* 代码块样式 */
:deep(.code-block) {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 14px 16px;
  margin: 10px 0;
  overflow-x: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  backdrop-filter: blur(8px);
}

:deep(.inline-code) {
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--accent-3);
}

/* 打字光标 - 点点点 */
.typing-cursor {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  vertical-align: middle;
}

.typing-cursor span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-1);
  animation: typing-dot 1.4s ease-in-out infinite;
  box-shadow: 0 0 4px rgba(99, 102, 241, 0.4);
}

.typing-cursor span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-cursor span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-dot {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.3;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 流式输出等待状态 */
.message.assistant .msg-avatar {
  transition: box-shadow 0.3s;
}

.message.assistant.streaming .msg-avatar {
  animation: avatar-pulse 2s ease-in-out infinite;
}

@keyframes avatar-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
  }
}

/* 流式文字渐入效果 */
.streaming-text {
  min-height: 1.7em;
}

/* 用户消息气泡尾部 */
.message.user .msg-content {
  position: relative;
}

/* ===== 输入区域 ===== */
.input-area {
  padding: 16px 24px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(var(--glass-blur));
  background: rgba(8, 8, 20, 0.5);
}

.input-area:not(.has-conversation) {
  border-top: none;
  background: none;
  backdrop-filter: none;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  max-width: 720px;
  margin: 0 auto;
}

.input-wrapper :deep(.el-textarea) {
  flex: 1;
}

.input-wrapper :deep(.el-textarea__inner) {
  min-height: 44px !important;
  padding: 12px 16px !important;
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  color: var(--text-secondary);
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.loading-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.16s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes dot-pulse {
  0%,
  60%,
  100% {
    transform: scale(0.5);
    opacity: 0.3;
  }
  30% {
    transform: scale(1);
    opacity: 1;
  }
}

.input-hint {
  text-align: center;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.4);
  margin-top: 8px;
}
</style>
