import app from "./app.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`pdf-listener server on http://localhost:${PORT}`));
