import * as cheerio from 'cheerio';
import axios from 'axios';

class QACrawler {

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
            return { url, questions: [] };
        }
    }

    analyzeQAStructure(html, url) {
        const $ = cheerio.load(html);
        const questions = [];
        
        // Méthode 1: Recherche des éléments avec la structure schema.org classique
        const schemaQuestions = this.findSchemaQuestions($, html, url);
        
        // Méthode 2: Recherche des questions basées sur la structure HTML sémantique (titres H2, H3, etc.)
        const semanticQuestions = this.findSemanticQuestions($, html, url);
        
        // Combinaison des résultats
        questions.push(...schemaQuestions, ...semanticQuestions);

        return {
            url,
            totalQuestions: questions.length,
            validQuestions: questions.filter(q => q.isValid).length,
            notValidQuestions : questions.filter(q => !q.isValid).length,
            questions,
            detectionMethods: {
                schema: schemaQuestions.length,
                semantic: semanticQuestions.length
            },
            timestamp: new Date().toISOString()
        };
    }

    findSchemaQuestions($, html, url) {
        const questions = [];
        
        $('[itemtype="https://schema.org/Question"]').each((index, element) => {
            const $question = $(element);
            
            const questionData = {
                index: index + 1,
                type: 'schema',
                isValid: true,
                issues: [],
                structure: {}
            };

            // Vérification de la structure Question schema.org
            this.validateSchemaQuestionStructure($question, questionData);
            
            // Vérification de la structure Answer schema.org
            this.validateSchemaAnswerStructure($question, questionData);
            
            questions.push(questionData);
        });
        
        return questions;
    }

    findSemanticQuestions($, html, url) {
        const questions = [];
        let questionIndex = 0;
        
        
        const $title = $('div.container-content').children('h2');
        $title.each((index, element) => {
            const $element = $(element);
            const $divParent = $element.closest('div');
        
            if ($divParent.attr('itemtype') !== 'https://schema.org/Question' || $divParent) {
                questionIndex++;
                
                const questionData = {
                    index: questionIndex,
                    type: 'semantic',
                    isValid: false, 
                    issues: ['Question détectée en format sémantique - manque les données structurées schema.org'],
                    structure: {}
                };

               
                this.validateSemanticQuestionStructure($element, questionData, $);
                
                questions.push(questionData);
            }
        });
        
        return questions;
    }

    validateSchemaQuestionStructure($question, questionData) {
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

        
        const $questionTitle = $question.find('[itemprop="name"]');
        if ($questionTitle.length === 0) {
            questionData.issues.push('Élément avec itemprop="name" manquant pour le titre de la question');
            questionData.isValid = false;
        } else {
            questionData.structure.questionTitle = $questionTitle.text().trim();
            questionData.structure.questionElement = $questionTitle.prop('tagName').toLowerCase();
        }
    }

    validateSchemaAnswerStructure($question, questionData) {
        const $answer = $question.find('[itemtype="https://schema.org/Answer"]');
        
        if ($answer.length === 0) {
            questionData.issues.push('Élément Answer manquant');
            questionData.isValid = false;
            return;
        }

        // Vérification des attributs sur Answer
        const answerItemScope = $answer.attr('itemscope');
        const answerItemProp = $answer.attr('itemprop');
        const answerItemType = $answer.attr('itemtype');

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
        const $answerText = $answer.find('[itemprop="text"]');
        if ($answerText.length === 0) {
            questionData.issues.push('Élément avec itemprop="text" manquant pour la réponse');
            questionData.isValid = false;
        } else {
            questionData.structure.answerText = $answerText.text().trim().substring(0, 200) + '...';
            questionData.structure.answerElement = $answerText.prop('tagName').toLowerCase();
        }
    }

    validateSemanticQuestionStructure($element, questionData, $) {
        const tagName = $element.prop('tagName').toLowerCase();
        const questionText = $element.text().trim();
        
        questionData.structure.questionTitle = questionText;
        questionData.structure.questionElement = tagName;
        
        // Ajout des issues spécifiques aux données structurées manquantes
        questionData.issues.push('Attribut itemscope manquant sur Question');
        questionData.issues.push('Attribut itemprop="mainEntity" manquant sur Question');
        questionData.issues.push('Attribut itemtype="https://schema.org/Question" manquant sur Question');
        questionData.issues.push('Élément avec itemprop="name" manquant pour le titre de la question');
        
        // Validation basique du contenu
        if (!questionText) {
            questionData.issues.push('Titre de question vide');
            return;
        }
        
        if (questionText.length < 10) {
            questionData.issues.push('Titre de question trop court (moins de 10 caractères)');
        }
        
        // Recherche du contenu de réponse suivant
        const $nextContent = this.findAnswerContent($element, $);
        
        if (!$nextContent || $nextContent.length === 0) {
            questionData.issues.push('Aucun contenu de réponse trouvé après la question');
            questionData.issues.push('Élément Answer avec itemtype="https://schema.org/Answer" manquant');
        } else {
            const answerText = $nextContent.text().trim();
            questionData.structure.answerText = answerText.substring(0, 200) + (answerText.length > 200 ? '...' : '');
            questionData.structure.answerElement = 'mixed-content';
            
            // Ajout des issues liées à la structure de réponse manquante
            questionData.issues.push('Élément Answer avec itemtype="https://schema.org/Answer" manquant');
            questionData.issues.push('Attribut itemscope manquant sur Answer');
            questionData.issues.push('Attribut itemprop="acceptedAnswer" manquant sur Answer');
            questionData.issues.push('Élément avec itemprop="text" manquant pour la réponse');
            
            if (answerText.length < 20) {
                questionData.issues.push('Contenu de réponse trop court (moins de 20 caractères)');
            }
        }
    }

    findAnswerContent($questionElement, $) {
        let $content = $();
        let $current = $questionElement.next();
        
        // Parcours des éléments suivants jusqu'au prochain titre ou fin de contenu
        while ($current.length > 0) {
            const tagName = $current.prop('tagName').toLowerCase();
            
            // Arrêt si on trouve un autre titre de même niveau ou supérieur
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                const currentLevel = parseInt(tagName.substring(1));
                const questionLevel = parseInt($questionElement.prop('tagName').substring(1));
                
                if (currentLevel <= questionLevel) {
                    break;
                }
            }
            
            $content = $content.add($current);
            $current = $current.next();
        }
        
        return $content;
    }

    // Méthode pour crawler plusieurs URLs
    async crawlMultipleUrls(urls) {
        const results = [];

        for (const url of urls) {
            console.log(`Crawl de: ${url}`);
            
            const result = await this.crawlWithAxios(url);
                
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
                urlsWithErrors: results.reduce((sum, r) => sum + (r.notValidQuestions || 0), 0),
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

export default QACrawler;