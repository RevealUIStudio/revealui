import { Route, Routes } from 'react-router-dom'
import { DocLayout } from './components/DocLayout'
import { ApiPage } from './routes/ApiPage'
import { GuidesPage } from './routes/GuidesPage'
import { HomePage } from './routes/HomePage'
import { ProPage } from './routes/ProPage'
import { SectionPage } from './routes/SectionPage'

export function App() {
  return (
    <DocLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/*" element={<SectionPage section="docs" title="Documentation" />} />
        <Route path="/api/*" element={<ApiPage />} />
        <Route path="/guides/*" element={<GuidesPage />} />
        <Route path="/pro/*" element={<ProPage />} />
      </Routes>
    </DocLayout>
  )
}
