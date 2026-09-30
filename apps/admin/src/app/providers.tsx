import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "../redux/store";
import OfflineNotice from "../component/OfflineNotice";
import AppRoutes from "./routes";

export default function Providers() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <OfflineNotice />
      </BrowserRouter>
    </Provider>
  );
}
