import QACrawler from './utils/utilsScraper.js';

const main = async () => {
  try {
    const urls = [
      "https://www.cofidis.fr/fr/pret-personnel/credit-mariage/assurance.html",
      "https://www.cofidis.fr/fr/credit-auto/credit-voiture-electrique/combien-emprunter.html",
    ];
    const crawler = new QACrawler();
    const results = await crawler.crawlMultipleUrls(urls);
    const report = crawler.generateReport(results);

    // Sauvegarde optionnelle en JSON
    const fs = await import("fs");
    fs.writeFileSync("crawl-report.json", JSON.stringify(report, null, 2));

    console.log("\nRapport sauvegardé dans crawl-report.json");
  } catch (error) {
    console.error("Erreur:", error);
  }
};

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}