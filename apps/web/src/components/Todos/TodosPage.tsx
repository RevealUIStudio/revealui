import type React from 'react'
import { useEffect, useState } from 'react'
import { api, type Todo } from '../../utils/api-client'

export function TodosPage(): React.ReactElement {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodoText, setNewTodoText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Fetch todos on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
  useEffect(() => {
    loadTodos()
  }, [])

  async function loadTodos() {
    setLoading(true)
    setError(null)
    const response = await api.todos.getAll()

    if (response.success && response.data) {
      setTodos(response.data)
    } else {
      setError(response.error || 'Failed to load todos')
    }
    setLoading(false)
  }

  async function handleCreateTodo(e: React.FormEvent) {
    e.preventDefault()

    if (!newTodoText.trim()) return

    setCreating(true)
    setError(null)

    const response = await api.todos.create(newTodoText.trim())

    if (response.success && response.data) {
      setTodos([...todos, response.data])
      setNewTodoText('')
    } else {
      setError(response.error || 'Failed to create todo')
    }

    setCreating(false)
  }

  async function handleToggleTodo(todo: Todo) {
    const response = await api.todos.update(todo.id, {
      completed: !todo.completed,
    })

    if (response.success && response.data) {
      const updatedTodo = response.data
      setTodos(todos.map((t) => (t.id === todo.id ? updatedTodo : t)))
    } else {
      setError(response.error || 'Failed to update todo')
    }
  }

  async function handleDeleteTodo(id: string) {
    const response = await api.todos.delete(id)

    if (response.success) {
      setTodos(todos.filter((t) => t.id !== id))
    } else {
      setError(response.error || 'Failed to delete todo')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Todo List</h1>
          <p className="text-gray-600">Full-stack demo: RevealUI (web) → Hono API → PostgreSQL</p>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateTodo} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating || !newTodoText.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading todos...</div>
        ) : todos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No todos yet. Add one above to get started!
          </div>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span
                  className={`flex-1 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Architecture: apps/web (RevealUI) → apps/api (Hono) → @revealui/db (Drizzle)</p>
        </footer>
      </div>
    </div>
  )
}
