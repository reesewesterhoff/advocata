import { HomeHero } from "./_components/home-hero";
import { homeCopy } from "./_lib/home-copy";

/**
 * Root marketing page for the application.
 */
const HomePage = () => {
  return <HomeHero title={homeCopy.title} description={homeCopy.description} />;
};

export default HomePage;
