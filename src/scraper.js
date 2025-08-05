import QACrawler from './utils/utilsScraper.js';

const main = async () => {
  try {
    const urls = [
      "https://www.cofidis.fr/fr/pret-personnel/credit-mariage/assurance.html",
      "https://www.cofidis.fr/fr/credit-auto/credit-voiture-electrique/combien-emprunter.html",
    ];
    
    const crawler = new QACrawler();
    
    // Méthode 1: Crawl d'abord, puis génération du rapport avec analyse des URLs KO
    const results = await crawler.crawlMultipleUrls(urls);
    const report = await crawler.generateReport(results, urls);

    // Méthode 2 alternative: Si vous voulez juste identifier les URLs KO sans crawl complet
    // const koUrls = await crawler.findKOUrls(urls);
    // console.log('URLs avec erreurs:', koUrls);

    // Sauvegarde optionnelle en JSON
    const fs = await import("fs");
    fs.writeFileSync("crawl-report.json", JSON.stringify(report, null, 2));

    console.log("\nRapport sauvegardé dans crawl-report.json");
    
    // Affichage des statistiques finales
    console.log(`\n📊 Résumé final:`);
    console.log(`- ${report.summary.urlsWithErrors}/${report.summary.totalUrls} URLs avec erreurs`);
    console.log(`- ${report.summary.totalInvalidQuestions}/${report.summary.totalQuestions} questions à corriger`);
    
  } catch (error) {
    console.error("Erreur:", error);
  }
};

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}