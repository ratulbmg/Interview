import app from "./app";

app.listen(process.env.API_PORT, () => {
  console.log(
    `API server started => http://localhost:${process.env.API_PORT}/`,
  );
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});
