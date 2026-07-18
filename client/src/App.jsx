import { BrowserRouter, Routes, Route } from "react-router-dom";
import Library from "./pages/Library.jsx";
import Reader from "./pages/Reader.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/book/:id" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}
