import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const API = '/api/todos'
const LISTS_API = '/api/lists'

// ── 기본 목록 ──────────────────────────────────────────────────────────────
const DEFAULT_LISTS = [
  { id: 'today',     name: '오늘',   icon: '☀️', color: '#FF9F0A' },
  { id: 'all',       name: '전체',   icon: '📋', color: '#5856D6' },
  { id: 'important', name: '중요',   icon: '⭐', color: '#FF3B30' },
  { id: 'completed', name: '완료됨', icon: '✓',  color: '#34C759' },
]

const PRIORITY = {
  none:   { label: '없음', color: '#C7C7CC' },
  low:    { label: '낮음', color: '#34AADC' },
  medium: { label: '보통', color: '#FF9500' },
  high:   { label: '높음', color: '#FF3B30' },
}

const LIST_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#A29BFE','#FD79A8','#FDCB6E']

// ── 날짜 헬퍼 ──────────────────────────────────────────────────────────────
const sod = (d = new Date()) => { const r = new Date(d); r.setHours(0,0,0,0); return r }

function fmtDate(ds) {
  if (!ds) return null
  const d = sod(new Date(ds)), today = sod(), diff = Math.round((d - today) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff < 0) return `${d.getMonth()+1}/${d.getDate()} 지남`
  return `${d.getMonth()+1}월 ${d.getDate()}일`
}

function isOverdue(ds) {
  if (!ds) return false
  return sod(new Date(ds)) < sod()
}

function filterTodos(todos, listId) {
  const today = sod(), tom = new Date(today); tom.setDate(tom.getDate()+1)
  switch (listId) {
    case 'today':
      return todos.filter(t => !t.completed && t.dueDate
        && sod(new Date(t.dueDate)) >= today && sod(new Date(t.dueDate)) < tom)
    case 'all':       return todos.filter(t => !t.completed)
    case 'important': return todos.filter(t => !t.completed && t.priority === 'high')
    case 'completed': return todos.filter(t => t.completed)
    default:          return todos.filter(t => !t.completed && t.listId === listId)
  }
}

function toDateInput(ds) {
  if (!ds) return ''
  return new Date(ds).toISOString().split('T')[0]
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function App() {
  const [todos, setTodos]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [customLists, setCustomLists] = useState([])
  const [activeList, setActiveList] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [addTitle, setAddTitle]     = useState('')
  const [newListName, setNewListName] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [newTag, setNewTag]         = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [saveErr, setSaveErr]       = useState(null)

  const allLists  = [...DEFAULT_LISTS, ...customLists]
  const listInfo  = allLists.find(l => l.id === activeList) || DEFAULT_LISTS[1]
  const filtered  = filterTodos(todos, activeList)
  const selected  = todos.find(t => t._id === selectedId) || null

  // 불러오기
  useEffect(() => {
    axios.get(API).then(r => setTodos(r.data)).finally(() => setLoading(false))
    axios.get(LISTS_API).then(r => setCustomLists(r.data))
  }, [])

  // 선택 항목이 삭제되면 선택 해제
  useEffect(() => {
    if (selectedId && !todos.find(t => t._id === selectedId)) setSelectedId(null)
  }, [todos, selectedId])

  // ── API 래퍼 ─────────────────────────────────────────────────────────────
  const update = useCallback(async (id, patch) => {
    // 즉시 UI에 반영 (옵티미스틱 업데이트)
    setTodos(prev => prev.map(t => t._id === id ? { ...t, ...patch } : t))
    try {
      const res = await axios.put(`${API}/${id}`, patch)
      setTodos(prev => prev.map(t => t._id === id ? res.data : t))
      return res.data
    } catch (err) {
      setSaveErr('저장에 실패했습니다. 서버를 확인해주세요.')
      setTimeout(() => setSaveErr(null), 3000)
    }
  }, [])

  const remove = useCallback(async (id) => {
    await axios.delete(`${API}/${id}`)
    setTodos(prev => prev.filter(t => t._id !== id))
  }, [])

  // ── 할 일 추가 ────────────────────────────────────────────────────────────
  const addTodo = async (e) => {
    e.preventDefault()
    const title = addTitle.trim()
    if (!title) return
    const extra = {}
    if (activeList === 'today')     extra.dueDate  = new Date().toISOString()
    if (activeList === 'important') extra.priority = 'high'
    if (!['today','all','important','completed'].includes(activeList)) extra.listId = activeList
    const res = await axios.post(API, { title, ...extra })
    setTodos(prev => [res.data, ...prev])
    setAddTitle('')
    setSelectedId(res.data._id)
  }

  // ── 목록 관리 ─────────────────────────────────────────────────────────────
  const addList = async (e) => {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    const id = 'list-' + Date.now()
    const color = LIST_COLORS[customLists.length % LIST_COLORS.length]
    const newList = { id, name, icon: '📝', color }
    setCustomLists(prev => [...prev, newList])
    setNewListName(''); setShowNewList(false); setActiveList(id)
    try {
      await axios.post(LISTS_API, newList)
    } catch {
      setCustomLists(prev => prev.filter(l => l.id !== id))
    }
  }

  const removeList = async (listId) => {
    setCustomLists(prev => prev.filter(l => l.id !== listId))
    if (activeList === listId) setActiveList('all')
    try {
      await axios.delete(`${LISTS_API}/${listId}`)
      // 고아 todos의 listId를 로컬에서도 null로 초기화
      setTodos(prev => prev.map(t => t.listId === listId ? { ...t, listId: null } : t))
    } catch {
      // 실패해도 UI는 이미 반영됨 (재시작 시 서버 상태로 복원)
    }
  }

  const countOf = (listId) => filterTodos(todos, listId).length

  // ── 서브태스크 (Fix 2: atomic API 사용) ─────────────────────────────────────
  const addSubtask = async (e) => {
    e.preventDefault()
    if (!selected || !newSubtask.trim()) return
    const title = newSubtask.trim()
    setNewSubtask('')
    try {
      const res = await axios.post(`${API}/${selected._id}/subtasks`, { title })
      setTodos(prev => prev.map(t => t._id === selected._id ? res.data : t))
    } catch {
      setSaveErr('서브태스크 추가 실패')
      setTimeout(() => setSaveErr(null), 3000)
    }
  }

  const toggleSubtask = async (sid, current) => {
    if (!selected) return
    try {
      const res = await axios.put(`${API}/${selected._id}/subtasks/${sid}`, { completed: !current })
      setTodos(prev => prev.map(t => t._id === selected._id ? res.data : t))
    } catch {
      setSaveErr('서브태스크 저장 실패')
      setTimeout(() => setSaveErr(null), 3000)
    }
  }

  const removeSubtask = async (sid) => {
    if (!selected) return
    try {
      const res = await axios.delete(`${API}/${selected._id}/subtasks/${sid}`)
      setTodos(prev => prev.map(t => t._id === selected._id ? res.data : t))
    } catch {
      setSaveErr('서브태스크 삭제 실패')
      setTimeout(() => setSaveErr(null), 3000)
    }
  }

  // ── 태그 ──────────────────────────────────────────────────────────────────
  const addTag = async (e) => {
    e.preventDefault()
    if (!selected || !newTag.trim()) return
    const tag = newTag.trim().replace(/^#/, '')
    if (selected.tags?.includes(tag)) { setNewTag(''); return }
    await update(selected._id, { tags: [...(selected.tags || []), tag] })
    setNewTag('')
  }

  const removeTag = async (tag) => {
    if (!selected) return
    await update(selected._id, { tags: selected.tags.filter(t => t !== tag) })
  }

  // ── 디바운스 저장 (Fix 1: 필드별 타이머 분리) ────────────────────────────────
  const saveTimers = useRef({})
  const debounce = (id, field, value) => {
    const key = `${id}-${field}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => update(id, { [field]: value }), 600)
  }

  // ── 네비게이션 선택 ───────────────────────────────────────────────────────
  const selectList = (id) => {
    setActiveList(id); setSelectedId(null); setSidebarOpen(false)
  }

  // ── 완료율 계산 ───────────────────────────────────────────────────────────
  const totalActive = todos.filter(t => !t.completed).length
  const totalDone   = todos.filter(t => t.completed).length
  const doneRate    = todos.length ? Math.round((totalDone / todos.length) * 100) : 0

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      <div className="app">
        {/* ── 사이드바 오버레이 (모바일) ── */}
        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ── 사이드바 ── */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-top">
            <div className="app-brand">Todo</div>
          </div>

          {/* 기본 목록 */}
          <nav className="nav-section">
            {DEFAULT_LISTS.map(l => (
              <button key={l.id} className={`nav-item${activeList === l.id ? ' active' : ''}`} onClick={() => selectList(l.id)}>
                <span className="nav-icon" style={{ color: l.color }}>{l.icon}</span>
                <span className="nav-name">{l.name}</span>
                {countOf(l.id) > 0 && <span className="nav-count">{countOf(l.id)}</span>}
              </button>
            ))}
          </nav>

          {/* 커스텀 목록 */}
          {customLists.length > 0 && (
            <nav className="nav-section">
              <div className="nav-label">내 목록</div>
              {customLists.map(l => (
                <button key={l.id} className={`nav-item${activeList === l.id ? ' active' : ''}`} onClick={() => selectList(l.id)}>
                  <span className="nav-dot" style={{ background: l.color }} />
                  <span className="nav-name">{l.name}</span>
                  {countOf(l.id) > 0 && <span className="nav-count">{countOf(l.id)}</span>}
                  <span className="nav-del" onClick={e => { e.stopPropagation(); removeList(l.id) }}>✕</span>
                </button>
              ))}
            </nav>
          )}

          {/* 목록 추가 */}
          <div className="nav-section">
            {showNewList ? (
              <form onSubmit={addList}>
                <input className="new-list-input" autoFocus value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="목록 이름 입력 후 Enter"
                  onBlur={() => { if (!newListName.trim()) setShowNewList(false) }} />
              </form>
            ) : (
              <button className="nav-item add-list" onClick={() => setShowNewList(true)}>
                <span className="nav-icon" style={{ color: '#8E8E93' }}>+</span>
                <span className="nav-name">새 목록</span>
              </button>
            )}
          </div>

          {/* 통계 */}
          <div className="sidebar-stats">
            <div className="stats-title">통계</div>
            <div className="stats-row">
              <div className="stats-box">
                <div className="stats-num">{totalActive}</div>
                <div className="stats-lbl">남은 할 일</div>
              </div>
              <div className="stats-box">
                <div className="stats-num">{totalDone}</div>
                <div className="stats-lbl">완료</div>
              </div>
            </div>
            <div className="stats-bar-wrap">
              <div className="stats-bar-label">
                <span>완료율</span><span>{doneRate}%</span>
              </div>
              <div className="stats-bar-bg">
                <div className="stats-bar-fill" style={{ width: `${doneRate}%` }} />
              </div>
            </div>
          </div>
        </aside>

        {/* ── 메인 ── */}
        <main className="main">
          {/* 헤더 */}
          <header className="main-header">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <div className="header-title">
              <span className="header-icon" style={{ color: listInfo.color }}>{listInfo.icon}</span>
              {listInfo.name}
            </div>
            <div className="header-count">{filtered.length}</div>
          </header>

          {/* 할 일 목록 */}
          <div className="todo-area">
            {loading ? (
              <div className="empty-msg">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-msg">
                <div className="empty-icon">✓</div>
                <div>모든 할 일 완료!</div>
              </div>
            ) : (
              <ul className="todo-list">
                {filtered.map(todo => {
                  const subDone = (todo.subtasks || []).filter(s => s.completed).length
                  const subTotal = (todo.subtasks || []).length
                  const overdue = isOverdue(todo.dueDate) && !todo.completed
                  return (
                    <li key={todo._id}
                      className={`todo-item${selectedId === todo._id ? ' selected' : ''}${todo.completed ? ' done' : ''}`}
                      onClick={() => setSelectedId(id => id === todo._id ? null : todo._id)}>
                      {/* 체크박스 */}
                      <button
                        className={`check-btn${todo.completed ? ' checked' : ''}`}
                        style={todo.completed ? {} : { borderColor: PRIORITY[todo.priority || 'none'].color }}
                        onClick={e => { e.stopPropagation(); update(todo._id, { completed: !todo.completed }) }}
                        aria-label="완료 토글"
                      >
                        {todo.completed && <span className="check-icon">✓</span>}
                      </button>

                      {/* 내용 */}
                      <div className="todo-content">
                        <span className="todo-title">{todo.title}</span>
                        <div className="todo-meta">
                          {subTotal > 0 && (
                            <span className="meta-chip">
                              ☑ {subDone}/{subTotal}
                            </span>
                          )}
                          {todo.tags?.length > 0 && (
                            <span className="meta-chip">#{todo.tags[0]}{todo.tags.length > 1 ? ` +${todo.tags.length-1}` : ''}</span>
                          )}
                          {todo.dueDate && (
                            <span className={`meta-chip${overdue ? ' overdue' : ''}`}>
                              {overdue ? '⚠ ' : '📅 '}{fmtDate(todo.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 우선순위 플래그 */}
                      {todo.priority && todo.priority !== 'none' && (
                        <span className="priority-flag" style={{ color: PRIORITY[todo.priority].color }}>▶</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 추가 폼 */}
          {activeList !== 'completed' && (
            <form className="add-form" onSubmit={addTodo}>
              <span className="add-plus">+</span>
              <input className="add-input" value={addTitle} onChange={e => setAddTitle(e.target.value)}
                placeholder="할 일 추가..." />
            </form>
          )}
        </main>

        {/* ── 상세 패널 ── */}
        {selected && (
          <aside className="detail">
            <div className="detail-inner">
              {saveErr && <div className="save-err">{saveErr}</div>}
              {/* 제목 */}
              <div className="detail-section">
                <div className="detail-check-row">
                  <button
                    className={`check-btn lg${selected.completed ? ' checked' : ''}`}
                    style={selected.completed ? {} : { borderColor: PRIORITY[selected.priority || 'none'].color }}
                    onClick={() => update(selected._id, { completed: !selected.completed })}
                  >
                    {selected.completed && <span className="check-icon">✓</span>}
                  </button>
                  <input
                    className={`detail-title${selected.completed ? ' done' : ''}`}
                    defaultValue={selected.title}
                    key={selected._id + '-title'}
                    onChange={e => debounce(selected._id, 'title', e.target.value)}
                  />
                </div>
              </div>

              {/* 서브태스크 */}
              <div className="detail-section">
                <div className="detail-label">하위 항목</div>
                {(selected.subtasks || []).map((s) => (
                  <div key={s._id} className="subtask-row">
                    <button className={`check-btn sm${s.completed ? ' checked' : ''}`}
                      onClick={() => toggleSubtask(s._id, s.completed)}>
                      {s.completed && <span className="check-icon">✓</span>}
                    </button>
                    <span className={`subtask-title${s.completed ? ' done' : ''}`}>{s.title}</span>
                    <button className="icon-btn" onClick={() => removeSubtask(s._id)}>✕</button>
                  </div>
                ))}
                <form onSubmit={addSubtask} className="subtask-add-row">
                  <span className="add-plus-sm">+</span>
                  <input className="subtask-input" value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)} placeholder="하위 항목 추가" />
                </form>
                {(selected.subtasks || []).length > 0 && (
                  <div className="subtask-progress">
                    <div className="prog-bg">
                      <div className="prog-fill" style={{
                        width: `${Math.round((selected.subtasks.filter(s=>s.completed).length / selected.subtasks.length)*100)}%`
                      }} />
                    </div>
                    <span className="prog-pct">
                      {Math.round((selected.subtasks.filter(s=>s.completed).length / selected.subtasks.length)*100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* 메모 */}
              <div className="detail-section">
                <div className="detail-label">메모</div>
                <textarea className="detail-notes"
                  key={selected._id + '-notes'}
                  defaultValue={selected.notes || ''}
                  onChange={e => debounce(selected._id, 'notes', e.target.value)}
                  placeholder="메모 추가..." rows={3} />
              </div>

              {/* 마감일 */}
              <div className="detail-section">
                <div className="detail-label">마감일</div>
                <input type="date" className="detail-date"
                  value={toDateInput(selected.dueDate)}
                  onChange={e => update(selected._id, { dueDate: e.target.value || null })} />
              </div>

              {/* 우선순위 */}
              <div className="detail-section">
                <div className="detail-label">우선순위</div>
                <div className="priority-row">
                  {Object.entries(PRIORITY).map(([key, val]) => (
                    <button key={key}
                      className={`priority-btn${(selected.priority || 'none') === key ? ' active' : ''}`}
                      style={(selected.priority || 'none') === key ? { borderColor: val.color, color: val.color, background: val.color + '18' } : {}}
                      onClick={() => update(selected._id, { priority: key })}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 목록 */}
              <div className="detail-section">
                <div className="detail-label">목록</div>
                <select className="detail-select"
                  value={selected.listId || ''}
                  onChange={e => update(selected._id, { listId: e.target.value || null })}>
                  <option value="">없음</option>
                  {customLists.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* 태그 */}
              <div className="detail-section">
                <div className="detail-label">태그</div>
                <div className="tag-list">
                  {(selected.tags || []).map(tag => (
                    <span key={tag} className="tag-chip">
                      #{tag}
                      <button className="tag-del" onClick={() => removeTag(tag)}>✕</button>
                    </span>
                  ))}
                </div>
                <form onSubmit={addTag} className="tag-add-row">
                  <input className="tag-input" value={newTag}
                    onChange={e => setNewTag(e.target.value)} placeholder="#태그 추가" />
                </form>
              </div>

              {/* 삭제 */}
              <div className="detail-section">
                <button className="delete-btn" onClick={() => remove(selected._id)}>
                  🗑 할 일 삭제
                </button>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button className="detail-close" onClick={() => setSelectedId(null)}>✕</button>
          </aside>
        )}
      </div>
    </>
  )
}

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #F2F2F7;
    color: #1C1C1E;
    height: 100vh;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #000; color: #F2F2F7; }
  }

  #root {
    width: 100%; max-width: 100%; border: none;
    min-height: 100vh; text-align: left;
  }

  /* ── 레이아웃 ── */
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10;
    display: none;
  }

  @media (max-width: 768px) {
    .overlay { display: block; }
  }

  /* ── 사이드바 ── */
  .sidebar {
    width: 240px;
    min-width: 240px;
    background: #fff;
    border-right: 1px solid #E5E5EA;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    z-index: 20;
    transition: transform 0.25s ease;
  }

  @media (prefers-color-scheme: dark) {
    .sidebar { background: #1C1C1E; border-right-color: #38383A; }
  }

  @media (max-width: 768px) {
    .sidebar {
      position: fixed; left: 0; top: 0; bottom: 0;
      transform: translateX(-100%);
      box-shadow: 4px 0 20px rgba(0,0,0,0.15);
    }
    .sidebar.open { transform: translateX(0); }
  }

  .sidebar-top {
    padding: 20px 16px 12px;
    border-bottom: 1px solid #F2F2F7;
  }

  @media (prefers-color-scheme: dark) {
    .sidebar-top { border-bottom-color: #38383A; }
  }

  .app-brand {
    font-size: 22px;
    font-weight: 700;
    color: #007AFF;
    letter-spacing: -0.5px;
  }

  /* ── 네비 ── */
  .nav-section {
    padding: 8px 8px;
    border-bottom: 1px solid #F2F2F7;
  }

  @media (prefers-color-scheme: dark) {
    .nav-section { border-bottom-color: #38383A; }
  }

  .nav-label {
    font-size: 11px;
    font-weight: 600;
    color: #8E8E93;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 10px 6px;
  }

  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: none;
    background: none;
    border-radius: 8px;
    cursor: pointer;
    color: #1C1C1E;
    font-size: 14px;
    text-align: left;
    transition: background 0.1s;
    position: relative;
  }

  .nav-item:hover { background: #F2F2F7; }
  .nav-item.active { background: #E8F0FE; color: #007AFF; font-weight: 600; }

  @media (prefers-color-scheme: dark) {
    .nav-item { color: #F2F2F7; }
    .nav-item:hover { background: #2C2C2E; }
    .nav-item.active { background: #1C3A5F; color: #4DA3FF; }
  }

  .nav-icon { font-size: 16px; flex-shrink: 0; min-width: 20px; text-align: center; }
  .nav-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .nav-name { flex: 1; }
  .nav-count {
    font-size: 12px;
    color: #8E8E93;
    font-weight: 500;
    background: #F2F2F7;
    border-radius: 10px;
    padding: 1px 7px;
    min-width: 22px;
    text-align: center;
  }

  .nav-item.active .nav-count { background: #C8D9FF; color: #007AFF; }

  @media (prefers-color-scheme: dark) {
    .nav-count { background: #38383A; color: #8E8E93; }
    .nav-item.active .nav-count { background: #1C3A5F; color: #4DA3FF; }
  }

  .nav-del {
    display: none;
    font-size: 11px;
    color: #FF3B30;
    padding: 2px 5px;
    border-radius: 4px;
    line-height: 1;
  }
  .nav-item:hover .nav-del { display: block; }

  .add-list { color: #8E8E93 !important; }
  .add-list:hover { color: #007AFF !important; }

  .new-list-input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid #007AFF;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: #fff;
    color: #1C1C1E;
  }

  @media (prefers-color-scheme: dark) {
    .new-list-input { background: #2C2C2E; color: #F2F2F7; border-color: #4DA3FF; }
  }

  /* ── 통계 ── */
  .sidebar-stats {
    padding: 16px;
    margin-top: auto;
    border-top: 1px solid #F2F2F7;
  }

  @media (prefers-color-scheme: dark) {
    .sidebar-stats { border-top-color: #38383A; }
  }

  .stats-title {
    font-size: 11px;
    font-weight: 600;
    color: #8E8E93;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .stats-row { display: flex; gap: 8px; margin-bottom: 12px; }

  .stats-box {
    flex: 1;
    background: #F2F2F7;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
  }

  @media (prefers-color-scheme: dark) {
    .stats-box { background: #2C2C2E; }
  }

  .stats-num { font-size: 20px; font-weight: 700; color: #007AFF; }
  .stats-lbl { font-size: 10px; color: #8E8E93; margin-top: 2px; }

  .stats-bar-label {
    display: flex; justify-content: space-between;
    font-size: 12px; color: #8E8E93; margin-bottom: 5px;
  }

  .stats-bar-bg {
    height: 6px;
    background: #E5E5EA;
    border-radius: 3px;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .stats-bar-bg { background: #38383A; }
  }

  .stats-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #34C759, #30D158);
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  /* ── 메인 ── */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .main-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #fff;
    border-bottom: 1px solid #E5E5EA;
    flex-shrink: 0;
  }

  @media (prefers-color-scheme: dark) {
    .main-header { background: #1C1C1E; border-bottom-color: #38383A; }
  }

  .hamburger {
    background: none; border: none; cursor: pointer;
    font-size: 18px; color: #8E8E93; padding: 4px;
    display: none;
  }

  @media (max-width: 768px) {
    .hamburger { display: block; }
  }

  .header-title {
    flex: 1;
    font-size: 20px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon { font-size: 20px; }

  .header-count {
    font-size: 13px;
    color: #8E8E93;
    background: #F2F2F7;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 500;
  }

  @media (prefers-color-scheme: dark) {
    .header-count { background: #38383A; }
  }

  /* ── 목록 ── */
  .todo-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .empty-msg {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: #C7C7CC;
    font-size: 15px;
    padding-top: 80px;
  }

  .empty-icon {
    font-size: 40px;
    width: 64px; height: 64px;
    background: #F2F2F7;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #C7C7CC;
  }

  @media (prefers-color-scheme: dark) {
    .empty-icon { background: #2C2C2E; }
  }

  .todo-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #fff;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.1s, box-shadow 0.1s;
    border: 2px solid transparent;
  }

  .todo-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .todo-item.selected { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.12); }
  .todo-item.done { opacity: 0.5; }

  @media (prefers-color-scheme: dark) {
    .todo-item { background: #1C1C1E; }
    .todo-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .todo-item.selected { border-color: #4DA3FF; }
  }

  /* ── 체크박스 ── */
  .check-btn {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 2px solid #C7C7CC;
    background: none;
    cursor: pointer;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
    font-size: 0;
  }

  .check-btn.checked {
    background: linear-gradient(135deg, #34C759, #30D158);
    border-color: transparent;
  }

  .check-btn.lg { width: 26px; height: 26px; }
  .check-btn.sm { width: 18px; height: 18px; }

  .check-icon {
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .check-btn.lg .check-icon { font-size: 13px; }
  .check-btn.sm .check-icon { font-size: 9px; }

  /* ── 할 일 내용 ── */
  .todo-content { flex: 1; min-width: 0; }
  .todo-title {
    display: block;
    font-size: 15px;
    color: #1C1C1E;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .todo-item.done .todo-title { text-decoration: line-through; color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .todo-title { color: #F2F2F7; }
  }

  .todo-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
  }

  .meta-chip {
    font-size: 11px;
    color: #8E8E93;
    background: #F2F2F7;
    padding: 2px 7px;
    border-radius: 6px;
  }

  .meta-chip.overdue { color: #FF3B30; background: #FFF0EF; }

  @media (prefers-color-scheme: dark) {
    .meta-chip { background: #2C2C2E; }
    .meta-chip.overdue { background: #3D1A1A; }
  }

  .priority-flag { font-size: 11px; flex-shrink: 0; }

  /* ── 추가 폼 ── */
  .add-form {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    background: #fff;
    border-top: 1px solid #E5E5EA;
    flex-shrink: 0;
  }

  @media (prefers-color-scheme: dark) {
    .add-form { background: #1C1C1E; border-top-color: #38383A; }
  }

  .add-plus {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: #007AFF;
    color: #fff;
    font-size: 18px;
    font-weight: 300;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  .add-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 16px;
    background: transparent;
    color: #1C1C1E;
  }

  .add-input::placeholder { color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .add-input { color: #F2F2F7; }
  }

  /* ── 상세 패널 ── */
  .detail {
    width: 320px;
    min-width: 320px;
    background: #fff;
    border-left: 1px solid #E5E5EA;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }

  @media (prefers-color-scheme: dark) {
    .detail { background: #1C1C1E; border-left-color: #38383A; }
  }

  @media (max-width: 900px) {
    .detail {
      position: fixed; right: 0; top: 0; bottom: 0;
      box-shadow: -4px 0 20px rgba(0,0,0,0.1);
      z-index: 15;
    }
  }

  .detail-inner {
    flex: 1;
    overflow-y: auto;
    padding: 48px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-close {
    position: absolute;
    top: 12px; right: 14px;
    background: #F2F2F7;
    border: none;
    border-radius: 50%;
    width: 26px; height: 26px;
    cursor: pointer;
    font-size: 12px;
    color: #8E8E93;
    display: flex; align-items: center; justify-content: center;
  }

  @media (prefers-color-scheme: dark) {
    .detail-close { background: #38383A; color: #AEAEB2; }
  }

  .detail-section {
    padding: 12px 0;
    border-bottom: 1px solid #F2F2F7;
  }

  .detail-section:last-child { border-bottom: none; }

  @media (prefers-color-scheme: dark) {
    .detail-section { border-bottom-color: #38383A; }
  }

  .detail-label {
    font-size: 11px;
    font-weight: 600;
    color: #8E8E93;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .detail-check-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .detail-title {
    flex: 1;
    border: none;
    outline: none;
    font-size: 18px;
    font-weight: 600;
    background: transparent;
    color: #1C1C1E;
    line-height: 1.4;
    resize: none;
  }

  .detail-title.done { text-decoration: line-through; color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .detail-title { color: #F2F2F7; }
  }

  /* ── 서브태스크 ── */
  .subtask-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
  }

  .subtask-title {
    flex: 1;
    font-size: 14px;
    color: #1C1C1E;
  }

  .subtask-title.done { text-decoration: line-through; color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .subtask-title { color: #F2F2F7; }
  }

  .subtask-add-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
  }

  .add-plus-sm {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #E5E5EA;
    color: #8E8E93;
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  @media (prefers-color-scheme: dark) {
    .add-plus-sm { background: #38383A; }
  }

  .subtask-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
    background: transparent;
    color: #1C1C1E;
  }

  .subtask-input::placeholder { color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .subtask-input { color: #F2F2F7; }
  }

  .subtask-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .prog-bg {
    flex: 1;
    height: 4px;
    background: #E5E5EA;
    border-radius: 2px;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .prog-bg { background: #38383A; }
  }

  .prog-fill {
    height: 100%;
    background: #34C759;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .prog-pct { font-size: 11px; color: #8E8E93; min-width: 30px; text-align: right; }

  /* ── 메모 ── */
  .detail-notes {
    width: 100%;
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    padding: 10px;
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    background: #F9F9F9;
    color: #1C1C1E;
    line-height: 1.5;
  }

  .detail-notes::placeholder { color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .detail-notes { background: #2C2C2E; border-color: #38383A; color: #F2F2F7; }
  }

  /* ── 마감일 ── */
  .detail-date {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    font-size: 14px;
    background: #F9F9F9;
    color: #1C1C1E;
    outline: none;
    font-family: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .detail-date { background: #2C2C2E; border-color: #38383A; color: #F2F2F7; }
  }

  /* ── 우선순위 ── */
  .priority-row { display: flex; gap: 6px; flex-wrap: wrap; }

  .priority-btn {
    padding: 6px 12px;
    border: 1.5px solid #E5E5EA;
    border-radius: 20px;
    background: none;
    font-size: 12px;
    cursor: pointer;
    color: #8E8E93;
    transition: all 0.15s;
  }

  .priority-btn:hover { border-color: #C7C7CC; color: #1C1C1E; }
  .priority-btn.active { font-weight: 600; }

  @media (prefers-color-scheme: dark) {
    .priority-btn { border-color: #38383A; color: #8E8E93; }
    .priority-btn:hover { color: #F2F2F7; border-color: #8E8E93; }
  }

  /* ── 목록 선택 ── */
  .detail-select {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    font-size: 14px;
    background: #F9F9F9;
    color: #1C1C1E;
    outline: none;
    font-family: inherit;
    cursor: pointer;
  }

  @media (prefers-color-scheme: dark) {
    .detail-select { background: #2C2C2E; border-color: #38383A; color: #F2F2F7; }
  }

  /* ── 태그 ── */
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #EAF4FF;
    color: #007AFF;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
  }

  @media (prefers-color-scheme: dark) {
    .tag-chip { background: #1C3A5F; color: #4DA3FF; }
  }

  .tag-del {
    background: none; border: none;
    color: #007AFF; font-size: 10px;
    cursor: pointer; padding: 0 2px;
    opacity: 0.6;
  }
  .tag-del:hover { opacity: 1; }

  .tag-add-row { display: flex; }

  .tag-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #E5E5EA;
    border-radius: 8px;
    font-size: 14px;
    background: #F9F9F9;
    color: #1C1C1E;
    outline: none;
    font-family: inherit;
  }

  .tag-input::placeholder { color: #C7C7CC; }

  @media (prefers-color-scheme: dark) {
    .tag-input { background: #2C2C2E; border-color: #38383A; color: #F2F2F7; }
  }

  /* ── 삭제 ── */
  .delete-btn {
    width: 100%;
    padding: 11px;
    border: 1.5px solid #FF3B30;
    border-radius: 10px;
    background: #FFF0EF;
    color: #FF3B30;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }

  .delete-btn:hover { background: #FFE0DE; }

  @media (prefers-color-scheme: dark) {
    .delete-btn { background: #3D1A1A; }
    .delete-btn:hover { background: #4D2020; }
  }

  .icon-btn {
    background: none; border: none;
    color: #C7C7CC; font-size: 11px;
    cursor: pointer; padding: 3px 5px;
    border-radius: 4px;
  }

  .icon-btn:hover { color: #FF3B30; background: #FFF0EF; }

  .save-err {
    background: #FFF0EF;
    border: 1px solid #FFB3AE;
    color: #FF3B30;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    margin-bottom: 4px;
  }
`
