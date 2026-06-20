# Raport privind utilizarea toolurilor AI în dezvoltarea software

## Proiect

**AI Travel Planner** este o aplicație mobilă pentru planificarea călătoriilor,
formată dintr-un frontend React Native/Expo și un backend FastAPI. Aplicația
include doi agenți AI care rulează local prin Ollama: agentul pentru generarea
itinerariului și agentul pentru optimizarea bugetului.

Acest document descrie utilizarea toolurilor AI în procesul de dezvoltare. Ele
au fost folosite pentru analiză, proiectare, implementare, testare, depanare și
documentare. Echipa a revizuit codul generat, l-a integrat incremental și l-a
validat prin teste automate, rularea aplicației și code review în pull request-uri.

> Toolurile de dezvoltare asistată de AI nu trebuie confundate cu modelele locale
> Ollama din funcționalitatea aplicației: primele au ajutat echipa să construiască
> software-ul, iar ultimele sunt parte din produsul livrat utilizatorilor.

## Tooluri utilizate

| Tool | Utilizare în proiect |
|---|---|
| GitHub Copilot | Propuneri de cod, completare contextuală, componente frontend și refactorizări. |
| Codex | Implementare și depanare, în special pentru backend; ulterior și pentru frontend, teste și documentație. |
| Claude | Construcția și rafinarea prompturilor, analiză de soluții și generare de cod. |
| Claude în Cursor | Asistență contextuală în editor, inclusiv pentru formularea mai detaliată a prompturilor și implementare. |
| Gemini | Brainstorming, analiză, propuneri de implementare și completarea/refinarea codului. |
| ChatGPT | Brainstorming, clarificarea cerințelor și asistență pentru implementare/documentare. |

## Contribuția membrilor echipei

| Membru | Tooluri AI folosite | Mod de utilizare |
|---|---|---|
| Antonia Gridan | Gemini, GitHub Copilot | Asistență pentru analiză și implementare prin sugestii de cod și completare contextuală. |
| Maria Petric | Codex, Claude | Asistență la implementare, analiză și formularea/rafinarea soluțiilor. |
| Bianca Lăutaru | Claude în Cursor, Codex, Gemini | Formularea unor prompturi mai detaliate, analiză și implementare asistată. |
| Gabriela | Codex, Gemini, ChatGPT | Asistență la analiză, implementare și clarificarea soluțiilor tehnice. |
| Antonia Stoica | Claude, Codex, GitHub Copilot | Claude pentru construirea prompturilor; Codex preponderent pentru backend și ulterior frontend; Copilot preponderent pentru frontend. |

## Utilizarea AI pe etapele procesului de dezvoltare

### 1. Analiza cerințelor și backlog

AI a fost folosit pentru clarificarea cerințelor, transformarea ideilor în user
stories și identificarea criteriilor de acceptanță. Backlogul proiectului este
gestionat în Jira și conține minimum zece user stories. Înainte de implementare,
propunerile generate au fost adaptate la tema proiectului și prioritizate de echipă.

### 2. Proiectare și arhitectură

Echipa a folosit AI pentru discutarea structurii aplicației, separarea
frontend/backend, modelarea entităților și conturarea fluxurilor principale.
Rezultatul este documentat în README prin diagrame Mermaid: diagramă de clase,
use-case-uri, secvențe și ciclul de viață al itinerariului.

Pentru funcționalitatea AI a produsului, au fost proiectați doi agenți separați:

- **Itinerary Agent**: generează un itinerariu structurat, cu activități, intervale
  orare și costuri estimate;
- **Budget Optimizer Agent**: propune alternative mai ieftine pentru activitățile
  costisitoare.

Ambele răspunsuri sunt cerute în JSON și validate cu scheme Pydantic înainte de a
fi trimise către client.

### 3. Implementare

AI a fost folosit pentru a accelera crearea de endpoint-uri FastAPI, scheme
Pydantic, repository-uri SQLAlchemy, componente React Native, validări de formular
și utilitare. Sugestiile nu au fost adăugate automat: codul a fost adaptat la
structura existentă, verificat local și revizuit în Git.

Exemple de zone implementate cu asistență AI:

- integrarea Ollama și tratarea răspunsurilor invalide sau indisponibilității
  serviciului;
- autentificare, roluri și funcționalități de administrare;
- generarea, salvarea, regenerarea activităților și exportul PDF al itinerariilor;
- ecrane React Native, componente reutilizabile și tratarea erorilor în interfață;
- monitorizare Prometheus/Grafana și metrici pentru apelurile agenților.

### 4. Testare și evaluarea agenților

AI a fost folosit pentru propunerea cazurilor de test, extinderea testelor și
investigarea erorilor. Testele au fost apoi rulate și rezultatele au fost verificate
de echipă.

Evaluarea automată a comportamentului agenților este acoperită prin teste
deterministe care verifică, între altele:

- validarea răspunsurilor JSON și a schemelor Pydantic;
- existența exact a trei activități pe zi și coerența structurii itinerariului;
- tratarea răspunsurilor invalide, timeout-urilor și erorilor de conectare la Ollama;
- folosirea modelului de fallback;
- validarea outputului pentru optimizarea bugetului;
- test de integrare, marcat separat, pentru conexiunea la o instanță Ollama locală.

Suitele sunt localizate în `backend/tests/`, inclusiv `test_agents.py`,
`test_ollama.py`, `test_ollama_integration.py`,
`test_itinerary_json_output.py` și `test_budget_optimizer_endpoint.py`. Frontendul
are teste Jest în `frontend/__tests__/`. Pipeline-ul CI rulează aceste teste la
push și pull request.

### 5. Depanare și code review

AI a ajutat la interpretarea mesajelor de eroare, formularea ipotezelor și
propunerea de corecții. Corecțiile au fost păstrate doar după verificare locală și
review. În procesul GitHub au fost utilizate pull request-uri, inclusiv review-uri
cu modificări solicitate și comentarii pentru defectele identificate; acestea au
fost corectate înainte de aprobarea/integrarea modificărilor.

Un exemplu documentat este [Pull Request #13](https://github.com/antonia225/Travel-planner/pull/13),
unde a fost emis un [review cu „Requested changes”](https://github.com/antonia225/Travel-planner/pull/13#pullrequestreview-4267536407).
Review-ul a raportat concret:

- inconsistența valorii implicite `OLLAMA_BASE_URL` între agent, configurare și
  rularea în Docker;
- maparea eronată a unei erori de configurare `AI_AGENT_PROVIDER` la HTTP 400;
- un import `MagicMock` neutilizat;
- testarea unei excepții diferite de cea întoarsă în mod uzual de clientul Ollama;
- plasarea necorespunzătoare a fișierului `test_agents.py`.

Acest review și modificările ulterioare din pull request constituie evidența
fluxului de raportare a bugurilor și rezolvare prin pull request.

### 6. Documentare și livrare

AI a fost folosit pentru structurarea documentației tehnice și explicarea modului
de rulare, a arhitecturii, a diagramelor și a testelor. Documentația finală a fost
verificată și adaptată de echipă pentru a reflecta repository-ul.

## Validare și limite

Folosirea AI a redus timpul necesar pentru activități repetitive, însă nu a
înlocuit responsabilitatea echipei. Pentru fiecare contribuție importantă au fost
aplicate una sau mai multe dintre următoarele verificări:

- rularea testelor automate backend și frontend;
- verificarea tipurilor și a contractelor de date;
- rularea aplicației și testare manuală a fluxurilor;
- code review și istoricul pull request-urilor;
- verificarea manuală a prompturilor și a răspunsurilor generate de agenți.

Modelele pot produce cod incomplet, incompatibil cu proiectul sau răspunsuri AI
invalide. Din acest motiv, backendul validează outputurile LLM, tratează erorile și
folosește fallback unde este cazul, iar codul propus de toolurile de dezvoltare a
fost revizuit înainte de integrare.