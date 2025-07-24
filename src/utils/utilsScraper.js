const puppeteer = import('puppeteer');
const cheerio = import('cheerio');
const axios = import('axios');

class QACrawler {
    constructor() {
        this.browser = null;
    }

    async init() {
        this.browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    // Méthode utilisant Puppeteer (pour sites avec JS)
    async crawlWithPuppeteer(url) {
        const page = await this.browser.newPage();
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2' });
            const html = await page.content();
            return this.analyzeQAStructure(html, url);
        } catch (error) {
            console.error(`Erreur lors du crawl de ${url}:`, error.message);
            return { url, error: error.message, questions: [] };
        } finally {
            await page.close();
        }
    }

    // Méthode utilisant Axios + Cheerio (plus rapide pour sites statiques)
    async crawlWithAxios(url) {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return this.analyzeQAStructure(response.data, url);
        } catch (error) {
            console.error(`Erreur lors du crawl de ${url}:`, error.message);
            return { url, error: error.message, questions: [] };
        }
    }

    analyzeQAStructure(html, url) {
        const $ = cheerio.load(html);
        const questions = [];
        
        // Recherche des éléments avec la structure Q&A
        $('[itemtype="https://schema.org/Question"]').each((index, element) => {
            const $question = $(element);
            
            const questionData = {
                index: index + 1,
                isValid: true,
                issues: [],
                structure: {}
            };

            // Vérification de la structure Question
            this.validateQuestionStructure($question, questionData);
            
            // Vérification de la structure Answer
            this.validateAnswerStructure($question, questionData);
            
            questions.push(questionData);
        });

        return {
            url,
            totalQuestions: questions.length,
            validQuestions: questions.filter(q => q.isValid).length,
            questions,
            timestamp: new Date().toISOString()
        };
    }

    validateQuestionStructure($question, questionData) {
        // Vérification des attributs requis sur l'élément Question
        const itemScope = $question.attr('itemscope');
        const itemProp = $question.attr('itemprop');
        const itemType = $question.attr('itemtype');

        if (itemScope === undefined) {
            questionData.issues.push('Attribut itemscope manquant sur Question');
            questionData.isValid = false;
        }

        if (itemProp !== 'mainEntity') {
            questionData.issues.push(`itemprop incorrect sur Question: "${itemProp}" au lieu de "mainEntity"`);
            questionData.isValid = false;
        }

        if (itemType !== 'https://schema.org/Question') {
            questionData.issues.push(`itemtype incorrect sur Question: "${itemType}"`);
            questionData.isValid = false;
        }

        // Recherche du titre de la question
        const $questionTitle = $question.find('[itemprop="name"]');
        if ($questionTitle.length === 0) {
            questionData.issues.push('Élément avec itemprop="name" manquant pour le titre de la question');
            questionData.isValid = false;
        } else {
            questionData.structure.questionTitle = $questionTitle.text().trim();
            questionData.structure.questionElement = $questionTitle.prop('tagName').toLowerCase();
        }
    }

    validateAnswerStructure($question, questionData) {
        // Recherche de la réponse acceptée
        const $answer = $question.find('[itemtype="https://schema.org/Answer"]');
        
        if ($answer.length === 0) {
            questionData.issues.push('Aucune réponse avec itemtype="https://schema.org/Answer" trouvée');
            questionData.isValid = false;
            return;
        }

        const $answerElement = $answer.first();

        // Vérification des attributs de la réponse
        const answerItemScope = $answerElement.attr('itemscope');
        const answerItemProp = $answerElement.attr('itemprop');
        const answerItemType = $answerElement.attr('itemtype');

        if (answerItemScope === undefined) {
            questionData.issues.push('Attribut itemscope manquant sur Answer');
            questionData.isValid = false;
        }

        if (answerItemProp !== 'acceptedAnswer') {
            questionData.issues.push(`itemprop incorrect sur Answer: "${answerItemProp}" au lieu de "acceptedAnswer"`);
            questionData.isValid = false;
        }

        if (answerItemType !== 'https://schema.org/Answer') {
            questionData.issues.push(`itemtype incorrect sur Answer: "${answerItemType}"`);
            questionData.isValid = false;
        }

        // Recherche du texte de la réponse
        const $answerText = $answerElement.find('[itemprop="text"]');
        if ($answerText.length === 0) {
            questionData.issues.push('Élément avec itemprop="text" manquant pour le contenu de la réponse');
            questionData.isValid = false;
        } else {
            questionData.structure.answerText = $answerText.text().trim();
            questionData.structure.answerLength = questionData.structure.answerText.length;
        }
    }

    // Méthode pour crawler plusieurs URLs
    async crawlMultipleUrls(urls, usePuppeteer = false) {
        const results = [];
        
        if (usePuppeteer && !this.browser) {
            await this.init();
        }

        for (const url of urls) {
            console.log(`Crawl de: ${url}`);
            
            const result = usePuppeteer 
                ? await this.crawlWithPuppeteer(url)
                : await this.crawlWithAxios(url);
                
            results.push(result);
            
            // Pause entre les requêtes pour éviter de surcharger le serveur
            await this.sleep(1000);
        }

        return results;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Génération d'un rapport détaillé
    generateReport(results) {
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
        console.log(`Taux de validité: ${((report.summary.totalValidQuestions / report.summary.totalQuestions) * 100).toFixed(2)}%`);

        return report;
    }
}
export default QACrawler