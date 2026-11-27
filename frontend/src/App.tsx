import { Route, Routes } from 'react-router-dom';
import { Toasts } from './components/ui/Toasts';
import { useAutosave } from './hooks/useAutosave';
import { useThemeEffect } from './hooks/useTheme';
import { EditorPage } from './pages/EditorPage';
import { LessonListPage } from './pages/LessonListPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TeachPage } from './pages/TeachPage';

export default function App() {
  useThemeEffect();
  useAutosave();

  return (
    <>
      <Routes>
        <Route path="/" element={<LessonListPage />} />
        <Route path="/lessons/:lessonId/teach" element={<TeachPage />} />
        <Route path="/lessons/:lessonId" element={<EditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toasts />
    </>
  );
}
