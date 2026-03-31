require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.log(err));

// ── 스키마 ──────────────────────────────────────────────────────────────────
const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
});

const todoSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  completed: { type: Boolean, default: false },
  priority:  { type: String, enum: ['none','low','medium','high'], default: 'none' },
  dueDate:   { type: Date, default: null },
  listId:    { type: String, default: null },
  subtasks:  { type: [subtaskSchema], default: [] },
  notes:     { type: String, default: '' },
  tags:      { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const listSchema = new mongoose.Schema({
  id:    { type: String, required: true, unique: true },
  name:  { type: String, required: true },
  icon:  { type: String, default: '📝' },
  color: { type: String, default: '#A29BFE' },
}, { timestamps: true });

const Todo = mongoose.model('Todo', todoSchema);
const List = mongoose.model('List', listSchema);

// ── 목록 API ─────────────────────────────────────────────────────────────────
app.get('/api/lists', async (req, res) => {
  try {
    const lists = await List.find().sort({ createdAt: 1 });
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', async (req, res) => {
  try {
    const { id, name, icon, color } = req.body;
    const list = new List({ id, name, icon, color });
    await list.save();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fix 4: 목록 삭제 시 고아 todos의 listId도 null로 초기화
app.delete('/api/lists/:id', async (req, res) => {
  try {
    await List.deleteOne({ id: req.params.id });
    await Todo.updateMany({ listId: req.params.id }, { $set: { listId: null } });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 할 일 API ─────────────────────────────────────────────────────────────────
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { title, priority, dueDate, listId, notes, tags } = req.body;
    const todo = new Todo({ title, priority, dueDate, listId, notes, tags });
    await todo.save();
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const allowed = ['title','completed','priority','dueDate','listId','subtasks','notes','tags'];
    const patch = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) patch[f] = req.body[f]; });
    const todo = await Todo.findByIdAndUpdate(req.params.id, patch, { returnDocument: 'after' });
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    console.error('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ message: '삭제 완료' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 서브태스크 API (Fix 2: atomic operations) ─────────────────────────────────
app.post('/api/todos/:id/subtasks', async (req, res) => {
  try {
    const { title } = req.body;
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      { $push: { subtasks: { title, completed: false } } },
      { returnDocument: 'after' }
    );
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/todos/:id/subtasks/:sid', async (req, res) => {
  try {
    const { completed, title } = req.body;
    const setFields = {};
    if (completed !== undefined) setFields['subtasks.$.completed'] = completed;
    if (title !== undefined) setFields['subtasks.$.title'] = title;
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, 'subtasks._id': req.params.sid },
      { $set: setFields },
      { returnDocument: 'after' }
    );
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id/subtasks/:sid', async (req, res) => {
  try {
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      { $pull: { subtasks: { _id: req.params.sid } } },
      { returnDocument: 'after' }
    );
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
}

module.exports = app;
