import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const port = process.env.PORT || 3000;
const app = createApp();

app.listen(port, () => {
    console.log(`HamVajeh backend listening on http://localhost:${port}`);
});
