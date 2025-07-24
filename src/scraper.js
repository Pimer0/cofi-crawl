import axios from 'axios';
import QACrawler from './utils/utilsScraper.js';

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const crawlAxios = async (url) => {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
            }
        });
        const crawler = new QACrawler();
        const results = crawler.analyzeQAStructure(response.data, url);
        return results;
    } catch (error) {
        console.error(`Erreur lors du crawl de ${url}:`, error.message);
        return {
            url, 
            error: error.message, 
            questions: []
        };
    }
};

const crawlMultipleUrls = async (urls) => {
    const results = [];

    for (const url of urls) {
        console.log(`Crawl de: ${url}`);
        
        const result = await crawlAxios(url);
        results.push(result);
        
        // Pause entre les requêtes pour éviter de surcharger le serveur
        await sleep(1000);
    }

    return results;
};

// Génération d'un rapport détaillé
const generateReport = (results) => {
    const report = {
        summary: {
            totalUrls: results.length,
            urlsWithErrors: results.filter(r => r.error).length,
            totalQuestions: results.reduce((sum, r) => sum + (r.totalQuestions || 0), 0),
            totalValidQuestions: results.reduce((sum, r) => sum + (r.validQuestions || 0), 0)
        },
        details: results
    };

    console.log('\n=== RAPPORT DE CRAWL ===');
    console.log(`URLs analysées: ${report.summary.totalUrls}`);
    console.log(`URLs avec erreurs: ${report.summary.urlsWithErrors}`);
    console.log(`Total questions trouvées: ${report.summary.totalQuestions}`);
    console.log(`Questions valides: ${report.summary.totalValidQuestions}`);
    
    if (report.summary.totalQuestions > 0) {
        console.log(`Taux de validité: ${((report.summary.totalValidQuestions / report.summary.totalQuestions) * 100).toFixed(2)}%`);
    }

    return report;
};

// Exemple d'utilisation
const main = async () => {
  try {
    const urls = [
      "https://www.cofidis.fr/fr/pret-personnel/credit-mariage/assurance.html",
      "https://www.cofidis.fr/fr/credit-auto/credit-voiture-electrique/combien-emprunter.html",
    ];

    const results = await crawlMultipleUrls(urls);
    const report = generateReport(results);

    // Sauvegarde optionnelle en JSON
    const fs = await import("fs");
    fs.writeFileSync("crawl-report.json", JSON.stringify(report, null, 2));

    console.log("\nRapport sauvegardé dans crawl-report.json");
  } catch (error) {
    console.error("Erreur:", error);
  }
};

// Export des fonctions pour utilisation en module
export { crawlAxios, crawlMultipleUrls, generateReport };

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}