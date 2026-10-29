import { app } from "./app.js";
import { db } from "./db.js";
const server = app.listen(Number(process.env.PORT || 3000), () => console.log("API listening on port " + (process.env.PORT || 3000)));
function stop(){ server.close(()=>{ db.close(); process.exit(0); }); }
process.on("SIGINT",stop); process.on("SIGTERM",stop);
