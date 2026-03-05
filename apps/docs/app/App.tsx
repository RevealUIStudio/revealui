import { Route, Routes } from 'react-router-dom'
import { DocLayout } from './components/DocLayout'
import { HomePage } from './routes/HomePage'
import { SectionPage } from './routes/SectionPage'

export function App() {
  return (
    <DocLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/*" element={<SectionPage section="docs" title="Documentation" />} />
      </Routes>
    </DocLayout>
  )
}
