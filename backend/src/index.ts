import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
    console.log(`HamVajeh backend listening on http://localhost:${port}`);
});
