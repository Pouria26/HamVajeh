import { Route, Routes } from "react-router-dom";
import { Header } from "./components/layout/Header";
import { BottomNav } from "./components/layout/BottomNav";
import { Footer } from "./components/layout/Footer";
import { PageContainer } from "./components/layout/PageContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { CollocationDetail } from "./pages/CollocationDetail";
import { Exercise } from "./pages/Exercise";
import { Browse } from "./pages/Browse";
import { DailyChallenge } from "./pages/DailyChallenge";
import { Admin } from "./pages/Admin";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <PageContainer>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/collocation/:id" element={<CollocationDetail />} />
              <Route path="/exercise" element={<Exercise />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/challenge" element={<DailyChallenge />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageContainer>
        </main>
        <Footer />
        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}

export default App;
