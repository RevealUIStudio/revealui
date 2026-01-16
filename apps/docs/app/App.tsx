import { Route, Routes } from 'react-router-dom'
import { DocLayout } from './components/DocLayout'
import { ApiPage } from './routes/ApiPage'
import { GuidesPage } from './routes/GuidesPage'
import { HomePage } from './routes/HomePage'
import { ReferencePage } from './routes/ReferencePage'

export function App() {
  return (
    <DocLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/guides/*" element={<GuidesPage />} />
        <Route path="/api/*" element={<ApiPage />} />
        <Route path="/reference/*" element={<ReferencePage />} />
      </Routes>
    </DocLayout>
  )
}
