import { createApp } from "./app";

const port = 4001;

createApp().listen(port, () => {
  console.log(`Mock vendor ready at http://localhost:${port}/health`);
});
