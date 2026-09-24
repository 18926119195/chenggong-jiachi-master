import { config } from 'dotenv';
config();

const { callLLM } = await import('./src/core/llmClient.js');

const words = [
  "refoulement","la subjectifie inconsciente","consciences","inconsciences","d'inconscience",
  "l'Inconscience","Freud","le Conscient","puis, ulterieurement: le Ca","le Moi","Ça","Moi","Surmoi",
  "l'Inconscient moléculaire","l'Inconscion","la psychologie","de la psychanalyse","psychanalystes",
  "causalité","raison suffisante","continuité","les procesus","vécus","rapport","sens strict",
  "processualité","doute","un certain flou","constance","fonction","différent","une processualité",
  "émergence","rapports","différence","mémoire","positions subjectives","les processus","sujet",
  "subjectivité","la subjectivité","pensée","la philosophie occidentale","subjectivation",
  "une subjectivité processuelle","subjectivité individuels et/ou collectifs","les pulsions",
  "formations subjectives","entités mentales","des «objets partiels","kleinisme","lacanisme",
  "la pensée","enoncination analytiques","la mémoire","l'imagination","Les figures inconscientes",
  "la psyché","la psychanalyse","partir d'autres échafaudages théoriques – si possible moins réductionnistes que ceux des freudiens et des lacaniens",
  "l'hystérie","inconscients","une *scène* inconsciente","une instance topique","freudisme","le rève",
  "refoule","la censure","Conscient","Préconscient","Inconscient","l'Inconscient","le concept d*Inconscient*.",
  "Freud «","un domaine inconscient","ce domaine inconscient","la conscience","psychoanalyse",
  "obédience lacanienne","le véritable Inconscient psychoanalyse","Inconciens","l'incoscient",
  "la cartographie freudienne","l'incogniscent","Le processus primaire","l'incognisci","la névrose",
  "la psychose","La tripartition lacanienne","instances topiques","l'Inconscient secondaire",
  "l'Inconscient primaire","l'Inconscien","l'Inconscient tertiaire","la cure","les interprétations",
  "que la prétendue *libre association*","au du transfert","son analyse","l'exploration psychanalytique",
  "suggestion directe","desir","psychanalyse","de transfer","l'enfance","divan-","la psychoanalyse",
  "la vie psychique","libido sexuelle²","d'Inconscien","l'Inconscient schizanalytique","mort freudienne",
  "toute métapsychologie","topiques","inconsciente","alors Freud","une causalité pulsionnelle",
  "le *processus primaire","dépalcement","surdetermination","librider","sublimations",
  "les étages somatiques et psychiques","le somatique","des effets psychiques","monde psychique",
  "la librida sexuelle","Éros","SÉMIOTIQUE FREUDIENNE","auto-analyse","des composantes énergétiques",
  "des instances","représentation mentale","topique","dynamique","representations","pulsons",
  "deux niveaux","Conscient*","la triade","Ca","les métaphores énergétiques","le mouvement psychanalytique",
  "concept","energie libidinale","le *scandale théorique","une *poussée*","la nature","biochimique",
  "sa source","excitation","érogénères","but","une homeostasie",
  "tensions engrédresses par les lesités excitations","psychique","des fantasmes",
  "la metapyschologie freudienne","notation énergétique","la thermo-dynamique","cette libido",
  "son statut énergétique","que d'une énergie assez particulière","théorie","les psychanalystes",
  "un psychanalyste","l'interprétation significante","l'exploration","Inconscion","libidinal",
  "sexuelles","l'hypothèse","chaque opération psychique","concepts thermodynamiques","origine",
  "la vie organique et psychique","un principé","défense","que d'un principe équilibre","de constance",
  "L'INCONSCIENT SCHIZOANALYTIQUE","un Inconscient","une économie","quantités pulsionnelles",
  "d'un dynamique","représentations conflictuelles","les Complexes","l'energie","la représentation",
  "le rêve","L'état disjonctif","refulement","l'Inconciert","la dénégation freudienne",
  "la pulSION freudienne","la folie","psu","lapsus","la psyanalyse","l'experience","l'acte",
  "système nerveux","Le acte","ambivalence","des comportements","mythes",
  "François Tosquelles, instant de voir selon Jacques Lacan, minute d'eternité pour les surrealistes, Satori Zeni, ou plus simplement retournement gestalistes,",
  "intérieur fort différente","la condition obsessionnelle","émotion","cognitifs",
  "psychiques, historiques","le freudisme –","La psychiatrie phénoménologique","La psychanalyse lacanienne",
  "symptômes","les mots","le traitement réductioniste","causes complexuelles","cachées",
  "une castration symbique","topique produit","la schizophrenie","les lapsus","la condensation",
  "surdétermination","le complexe","distinguer","oubliée","significatif","des contenus inconscients",
  "l'auto-analyse","de l'oubli","la libération sexuelle","un rêve","rêves¹.","L'affect colle",
  "la affect","l'affect qualitative","ergie pulsionnelle","syndromes psychopathologiques",
  "Les syndromes psychopathologiques","la psychopathologie","Idenfush","la fantasie",
  "auteurs psychanalytiques","Edipe","de castration","latence","le schéma psychogénetique",
  "les stades psychogénétiques","freudiens","revus","les dichotomies habituelles","l'imaginaire",
  "la résistance","la conscience imagente","fonction irrealisante","la fabulation","déferalisation",
  "un dialogue imaginaire","une constance subjective","ses impulsions","ses persversions paradigmatiques",
  "une fabulation déréalisante","fabulues","productrices","cette processualité primaire",
  "recueilisation primaire","Pierre Janet","Le freudisme","latent","l'association libre","freudien",
  "l'interprétation","fantasies","le déplacement","concepions freudiennes","narcissisme","Reich",
  "la fantasme","l'Èdèpe","un divan psychanalytique","une économie transférentielle","personnalisation",
  "de désir","Mélanie Klein'","Winnicott","nos souvenirs","apréhension hystérique","obsessionnelle",
  "paroanlique","theorie","une pulsion","des dimensions inconscientes","dissolutions","morcellement",
  "collapsus","dualisme","du complexe","la psyche","complexes infantiles","fixations",
  "certaines stases","67 Le surmoi","modele","domains","Agencements*","98 Flux","Flux*","Univers*",
  "figures*","les trois niveaux","profondes","bipolaire","résidu","L'énociation virtuelle",
  "Triangle sémiotique et triangle énonciatif ... 258 Graphiques, par Brigitte LOUDIEU",
  "Jaspers Jones","censure"
];

const question = "Pierre Janet和Freud对无意识的观点有何不同？";

function buildScorePrompt(question, yesNounSurfaces) {
  const list = yesNounSurfaces.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}

以下是你选中的相关词，请按重要程度打分（1-100）：
  1-30   弱相关：领域相关但非核心，仅提及
  31-60  中等相关：对答案有一定贡献
  61-80  强相关：重要概念，显著影响答案质量
  81-100 核心概念：没有它就无法准确回答

词语列表：
${list}

输出格式要求：
- 只输出【【N】】分数，每行一个，不要任何解释或额外文字
- 例如：【【1】】95
- 不要输出：【【1】】95（这个词很重要因为...）← 错误
- 不要使用思维链，不要推理过程，直接给出分数
- 严格按格式，开始输出：`;
}

const prompt = buildScorePrompt(question, words);
console.log('测试 prompt 长度:', prompt.length);

const res = await callLLM(prompt, { maxTokens: 32768 });

console.log('\n========== 结果检查 ==========');
console.log('usage:', JSON.stringify(res?.usage, null, 2));
const reasoningTokens = res?.usage?.completion_tokens_details?.reasoning_tokens;
console.log('reasoning_tokens:', reasoningTokens ?? '(无此字段)');
console.log('是否含 thinking:', reasoningTokens && reasoningTokens > 0 ? '是 ❌' : '否 ✓');
