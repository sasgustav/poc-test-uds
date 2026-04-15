import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { FaturaListPage } from './pages/FaturaListPage';
import { FaturaCreatePage } from './pages/FaturaCreatePage';
import { FaturaDetailPage } from './pages/FaturaDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<FaturaListPage />} />
          <Route path="/faturas/new" element={<FaturaCreatePage />} />
          <Route path="/faturas/:id" element={<FaturaDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
