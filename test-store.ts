import { getStore } from "./lib/server/store";

async function test() {
  try {
    console.log("Testing store initialization...");
    const store = getStore();
    console.log("Store initialized.");
    
    console.log("Listing projects...");
    const projects = await store.listProjects();
    console.log("Projects:", projects.length);
    
    if (projects.length > 0) {
      console.log("First project:", projects[0].name);
    }
    
    console.log("Test successful.");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

test();
