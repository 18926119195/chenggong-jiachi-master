# Non-High 条目判断结果

## 组 A：定位算法 bug，无需重跑 LLM (24 个)

这些条目里，LLM 报的名词确实存在于对应截断的原文中，只是定位算法第一层字符匹配没命中（可能是大小写、重音符号或子串边界问题）。**这些名词本身是有效的提取结果，不算漏提取，不需要重跑。**

| 批次 | 截断 | 名词 | 置信度 | 截断原文 |
|---|---|---|---|---|
| 3 | 【【83】】 | sociales | low | sociales émancipantes, devront bien finir par être recentrés sur un |
| 3 | 【【103】】 | processus | low | processus et peut-être de transformer cette |
| 3 | 【【106】】 | créateurs | low | créateurs. |
| 3 | 【【155】】 | capitalistiques | low | capitalistiques! On n'a pas assez souligne qu'un des |
| 3 | 【【206】】 | ancien | low | barbare. L'ancien |
| 3 | 【【218】】 | machinique | low | machinique? Ces mêmes |
| 10 | 【【174】】 | psychiques | low | somatiques et psychiques de la |
| 10 | 【【178】】 | psychiques | low | psychiques et de connaître le |
| 10 | 【【181】】 | psychique | low | psychique au |
| 11 | 【【41】】 | énergétique | low | énergétique associé à chaque |
| 11 | 【【122】】 | energetiques | medium | energetiques spécifiques. Quoi il en soit, ces |
| 17 | 【【214】】 | signalétiques | low | signalétiques correspondent à un |
| 19 | 【【271】】 | déterritorialisations | medium | ralenties et relativement déterritorialisations, qui caracterisent ce qui sera ultérieurement |
| 24 | 【【199】】 | existentielle | low | existentielle de l' |
| 24 | 【【204】】 | expressive | low | expressive, en se retournant en |
| 24 | 【【211】】 | registre | medium | au registre |
| 24 | 【【232】】 | modulaires | low | modulaires de |
| 24 | 【【241】】 | expressive | low | expressive et que je qualifierai de |
| 24 | 【【245】】 | expressive | low | expressive avait dépliées, a cei pris qu'il ramène en |
| 27 | 【【10】】 | essentielle | low | singulaire (essentielle par |
| 35 | 【【68】】 | autres | low | peut être tout autant « dégéglée » que les autres |
| 35 | 【【69】】 | Certaines | low | ! Certaines |
| 36 | 【【187】】 | semantiques | low | semantiques. l' |
| 36 | 【【195】】 | semantiques | low | semantiques de son |

---

## 组 B-1：截断疑似含名词，需要重跑/人工补提取 (301 个)

这些截断里，LLM 报的名词不在原文中（编号错位或幻觉），且截断原文本身看起来含有实质名词性内容（大写专名、典型名词后缀或长词）。**这些截断可能存在真实漏提取，建议重跑或人工补充。**

| 批次 | 截断 | LLM误报名词 | 置信度 | 截断原文 |
|---|---|---|---|---|
| 1 | 【【44】】 | macro-processus | low | ayant été à leur |
| 1 | 【【165】】 | speculaires | medium | qui ont cherché à appréhender ces |
| 10 | 【【55】】 | sécuritéaires | medium | structuraux de la |
| 10 | 【【55】】 | purificatrices | medium | structuraux de la |
| 10 | 【【64】】 | ultime | low | . Il parait appartenir, |
| 10 | 【【70】】 | cartographie | low | invalidants de l' |
| 10 | 【【70】】 | schizanalytique | low | invalidants de l' |
| 10 | 【【76】】 | folie | medium | à inventer une |
| 10 | 【【78】】 | premières | medium | naïvement scientifique, furent, tout |
| 10 | 【【83】】 | sociau | medium | psychique avec les |
| 10 | 【【86】】 | tique | medium | régionaux, de |
| 10 | 【【86】】 | tous | medium | régionaux, de |
| 10 | 【【87】】 | régionaux | medium | que se trouvent totalement désous et assimilés l' |
| 10 | 【【89】】 | intrinsèques | low | se rapportant à elles, et dans certains |
| 10 | 【【90】】 | certains | medium | extrêmes, l' |
| 10 | 【【91】】 | extrêmes | medium | energetiques eux-mêmes. |
| 10 | 【【95】】 | sociales | low | devaient apporter au |
| 10 | 【【95】】 | mentales | medium | devaient apporter au |
| 10 | 【【106】】 | sociales | medium | que devaient affirmer leur |
| 10 | 【【112】】 | entropique | medium | de mettre ceux qui en étaient |
| 10 | 【【209】】 | Inconsel | medium | la le *seconde topique* *freudienne, ou la |
| 10 | 【【223】】 | énergétique | medium | 1/ l'un, somatique, mettant en |
| 10 | 【【225】】 | biochimique | medium | n'est pas autrement |
| 10 | 【【232】】 | intersubjectives | low | 2/ l'autre, |
| 10 | 【【235】】 | prit | medium | C'est dès ses premiers |
| 10 | 【【238】】 | simple | low | freudienne. Il a |
| 10 | 【【246】】 | immortelle | low | . Toutefois, cette |
| 10 | 【【246】】 | axusexime | low | . Toutefois, cette |
| 10 | 【【252】】 | d'autant | low | . Mais il ne s'agissit plus, à l' |
| 10 | 【【252】】 | aisé | low | . Mais il ne s'agissit plus, à l' |
| 11 | 【【56】】 | beaucoup | low | n'est ici maintenu que par |
| 11 | 【【62】】 | iconiques | low | matériels, les |
| 11 | 【【72】】 | anima | low | manichéen entre ce que l'on pourrait appeler |
| 11 | 【【79】】 | abstraits | low | s'instaurant a |
| 11 | 【【80】】 | objectives | low | qui se puissent concevoir, elle présupposes divers |
| 11 | 【【81】】 | existentiels | low | matériels et énergétiques; 2) les |
| 11 | 【【82】】 | d'elle-même | low | machiniques abstraits qui |
| 11 | 【【85】】 | légales | low | d'elle-même ( |
| 11 | 【【111】】 | sous-semblés | low | Serres, ces |
| 11 | 【【111】】 | flous | low | Serres, ces |
| 11 | 【【116】】 | energetique | low | que les implique toutes dans des |
| 11 | 【【118】】 | chacune | low | energetique. Mais peut-être est-il préférable de prendre les |
| 11 | 【【118】】 | entités | low | energetique. Mais peut-être est-il préférable de prendre les |
| 11 | 【【120】】 | energetiques | low | , que chacune de ces entités妨ait advenir à ce |
| 11 | 【【121】】 | intensives | low | , qui manifeste des |
| 11 | 【【131】】 | símiotique | low | encyclopédique des |
| 11 | 【【138】】 | physiques | low | méthodologique, notre |
| 11 | 【【139】】 | logiques | low | scientifiques antérieures dans ce |
| 11 | 【【158】】 | lône | low | se réfère habituellement la |
| 11 | 【【163】】 | laisser-alter | low | devrait être entundi au |
| 11 | 【【168】】 | médias | low | communes! Que le |
| 11 | 【【168】】 | rien | low | communes! Que le |
| 11 | 【【170】】 | répétitives | low | non programmées (ou |
| 11 | 【【177】】 | L'energetique | low | névrotiques entre the narcissisme et les |
| 11 | 【【177】】 | généricale | low | névrotiques entre the narcissisme et les |
| 11 | 【【183】】 | sémiotique | low | J'appelle non-séparabilité les |
| 11 | 【【200】】 | producteurs | low | spécifées sous l' |
| 11 | 【【201】】 | sectoriel | low | thermodynamique, physico-chimique, |
| 11 | 【【209】】 | nombrant | low | ils soient effectivement devenus producteurs de |
| 11 | 【【211】】 | telle | low | », sectoriel, une |
| 11 | 【【218】】 | tels | low | que celles qui inspirent toute |
| 11 | 【【218】】 | paramètres | low | que celles qui inspirent toute |
| 11 | 【【228】】 | telle | low | retroactivement prospectivement sur le |
| 12 | 【【81】】 | dernière | low | *, qui différencie ces |
| 12 | 【【81】】 | contrainte | low | *, qui différencie ces |
| 12 | 【【84】】 | intrinseque | low | (tenseurs projectif-dichroniques). C'est de cette dernière contrainte que découlera la |
| 12 | 【【86】】 | II | low | intensives acquiert un |
| 12 | 【【88】】 | ontologique | low | vêtir » systemique ou structurele, et le |
| 12 | 【【111】】 | registre | low | , qui introduisent au |
| 12 | 【【112】】 | stoïcienne | low | irréductible de |
| 12 | 【【191】】 | trait | low | implique une |
| 12 | 【【254】】 | capitalistiques | low | abstraits ( |
| 12 | 【【259】】 | abstraits | low | inférieure au |
| 17 | 【【107】】 | mathematique | medium | nucleaire appliquée s'est trouvée en |
| 17 | 【【108】】 | appliquée | medium | de libérer des |
| 17 | 【【112】】 | ordinaires | medium | initial, pas d' |
| 17 | 【【113】】 | initial | medium | terminal. Et, par |
| 17 | 【【115】】 | big | medium | sur elle-même de l' |
| 17 | 【【154】】 | concrentes | low | . Traverserés de ce |
| 17 | 【【154】】 | double | low | . Traverserés de ce |
| 17 | 【【200】】 | concrete | medium | . Avec une telle |
| 17 | 【【230】】 | abstraites | low | incorporels et aux |
| 17 | 【【233】】 | existentiels | low | et inversé du |
| 17 | 【【239】】 | signalétiques | medium | sign-pariculture. Il en va tout autrement sur la |
| 17 | 【【243】】 | F+F | medium | , >maxime bien connue des |
| 17 | 【【245】】 | maxime | low | ontogénetique, des |
| 17 | 【【245】】 | connue | low | ontogénetique, des |
| 17 | 【【248】】 | reproductibles | low | qui autorise des |
| 17 | 【【251】】 | evolutives | low | relative, reproductible, |
| 17 | 【【252】】 | absolue | low | . C'est à nouveau dans le |
| 17 | 【【252】】 | solipsise | low | . C'est à nouveau dans le |
| 17 | 【【253】】 | relative | low | moléculaires, où se jouaient les |
| 17 | 【【253】】 | reproductible | low | moléculaires, où se jouaient les |
| 19 | 【【41】】 | existentielle | low | essentiellement glischroïdique, sans |
| 19 | 【【41】】 | sustant | low | essentiellement glischroïdique, sans |
| 19 | 【【41】】 | chaos | low | essentiellement glischroïdique, sans |
| 19 | 【【41】】 | d'un | low | essentiellement glischroïdique, sans |
| 19 | 【【123】】 | passive | medium | active et processuelle. |
| 19 | 【【127】】 | ambiante | medium | spécifique ser capable d'hydrater 100 000 |
| 19 | 【【129】】 | carbonique | low | pour obtenir le même |
| 19 | 【【133】】 | molécule | medium | et constitue un |
| 19 | 【【135】】 | *reconnaitant* | medium | d'autres, même de |
| 19 | 【【136】】 | d'autres | medium | troche, comme les |
| 19 | 【【140】】 | double | medium | très différentes, tandis que un |
| 19 | 【【186】】 | causale | low | intrinsque engagent elles-mêmes des |
| 19 | 【【186】】 | extrinsque | low | intrinsque engagent elles-mêmes des |
| 19 | 【【187】】 | intrinsque | medium | généralisés de |
| 19 | 【【188】】 | généralisés | medium | existentielle. Pour une |
| 19 | 【【193】】 | récursif | medium | possibles, alors que, pour une autre |
| 19 | 【【193】】 | toutes | low | possibles, alors que, pour une autre |
| 19 | 【【207】】 | primitive | medium | est donc peuplée de deux |
| 19 | 【【217】】 | immanentes | medium | ne procède pas par |
| 19 | 【【220】】 | distinctes | medium | systémique. La |
| 19 | 【【221】】 | systémique | medium | existente relèverait pluit des |
| 19 | 【【229】】 | travissant | low | , découptent des |
| 19 | 【【235】】 | discursives | medium | existentiel et d' |
| 19 | 【【238】】 | «acroche | medium | chaotiques. D' |
| 19 | 【【240】】 | continue | medium | assurent le |
| 19 | 【【242】】 | précédemment | medium | de conférer une |
| 19 | 【【242】】 | décrites | medium | de conférer une |
| 19 | 【【246】】 | recharger | low | considérés. Tant qu'on demeure sous un |
| 19 | 【【247】】 | considérés | low | de retourner au |
| 19 | 【【249】】 | s'operent | medium | entitiaires peuvent profilérer à l' |
| 19 | 【【250】】 | entitiaires | medium | . Cela étant, il ne faudra jamais perde de |
| 19 | 【【251】】 | Cela | low | constamment s'enveloppen les |
| 19 | 【【251】】 | perde | medium | constamment s'enveloppen les |
| 19 | 【【252】】 | constamment | medium | les autres, de telle |
| 19 | 【【252】】 | s'enveloppen | medium | les autres, de telle |
| 19 | 【【258】】 | gestalistes | medium | mnémotechniques, des |
| 19 | 【【259】】 | mnémotechniques | medium | poétiques, des |
| 19 | 【【261】】 | cognitives | low | bourisculaires, etc., partout, dans tous les |
| 19 | 【【265】】 | stochastiques | medium | actuelles dimentré répertoriales et consolidables. |
| 23 | 【【24】】 | plis | medium | representant la dernière |
| 24 | 【【53】】 | chaines | low | et de diagrams qui ont proliféré dans des |
| 25 | 【【98】】 | fondement | medium | , capable de porter |
| 25 | 【【98】】 | héterogénes | medium | , capable de porter |
| 25 | 【【102】】 | trop | medium | des complexes inconsciens, puis son |
| 25 | 【【102】】 | structuraliste | medium | des complexes inconsciens, puis son |
| 25 | 【【103】】 | partiels | medium | trop structuraliste des « |
| 25 | 【【104】】 | fractalis | medium | partiels », qu'il vaudrait mieux appeler ; |
| 25 | 【【106】】 | institutionnels | medium | énergible possible des |
| 25 | 【【109】】 | étatique | medium | bureaucratiques, de l' |
| 25 | 【【111】】 | baroquer | medium | sont à travailler, à |
| 25 | 【【111】】 | Prendre | medium | sont à travailler, à |
| 25 | 【【112】】 | normal | low | , à • baroquer ». Prendre en |
| 25 | 【【124】】 | perdu | low | processuelle, la |
| 25 | 【【137】】 | propres | low | . Mais nous ne pourrons en traiter qu'après avoir abordé les |
| 25 | 【【141】】 | monothése-capitalistique | low | possible des |
| 25 | 【【150】】 | temporelles | low | est tant ou peu capable de tenir debout par lui-même. Tel est |
| 25 | 【【150】】 | coordonnées | low | est tant ou peu capable de tenir debout par lui-même. Tel est |
| 25 | 【【164】】 | séparative | low | particuliers existent entre les |
| 25 | 【【166】】 | agregative | low | possiblistes. Ils ne sont pas véritablement discernables; ils entrent des |
| 25 | 【【167】】 | spéciques | low | existentiels et les |
| 25 | 【【172】】 | radical | low | agregative se trouvaient stratifiés en |
| 25 | 【【173】】 | synchroniques | low | spéciques de chaque |
| 25 | 【【173】】 | homothétiques | low | spéciques de chaque |
| 25 | 【【182】】 | autres | low | de possible . Mais ces |
| 25 | 【【184】】 | infini | low | qui ne répondent plus aux |
| 25 | 【【186】】 | chaosmous | low | et indistinctes les |
| 25 | 【【187】】 | infini | low | aux autres. Un |
| 25 | 【【228】】 | migrate | low | et représentent un |
| 25 | 【【229】】 | échelont | low | vibrataire du même |
| 25 | 【【233】】 | fractal | low | doublement hachéure de la même |
| 25 | 【【234】】 | actualisée | low | , ils existent à l' |
| 27 | 【【6】】 | incorporels | medium | mais qui, cependant, est singulier ou, plutôt réversiblement singularisé; voilà de quoi sont constitués les |
| 31 | 【【25】】 | ustensiles | low | . Seulement, ce |
| 31 | 【【25】】 | divers | low | . Seulement, ce |
| 35 | 【【57】】 | percutant | medium | relatif à l' |
| 35 | 【【105】】 | pouvoir | medium | . Ils renvoient toujours à des |
| 35 | 【【106】】 | mythographiques | low | de pouvoir de |
| 35 | 【【106】】 | institutionnelles | low | de pouvoir de |
| 35 | 【【106】】 | économiques | low | de pouvoir de |
| 35 | 【【109】】 | normal | medium | est moins visible lors de l' |
| 35 | 【【110】】 | discipinés | low | *normal* de la |
| 35 | 【【111】】 | généralisée | low | existentiels s'y trouvent plus discipinés, |
| 35 | 【【114】】 | rététatives | medium | , je rangerai des |
| 35 | 【【114】】 | ayant | low | , je rangerai des |
| 35 | 【【119】】 | invocatoires | low | peuvent prendre pour |
| 35 | 【【120】】 | *ritournelles | low | rythmiques, |
| 35 | 【【121】】 | perdu | low | prosodiques, des |
| 35 | 【【123】】 | sensible | low | avec les *ritournelles du |
| 35 | 【【125】】 | thè | low | *, qui entrent transversalement en |
| 35 | 【【126】】 | *petite | low | sensible (la |
| 35 | 【【126】】 | phrase* | low | sensible (la |
| 35 | 【【127】】 | thè | medium | trempée dans la |
| 35 | 【【133】】 | l'esthétique | low | énonciatifs partiels que s'opère une |
| 35 | 【【138】】 | existentiels | low | Que peut-on attendre de notre |
| 35 | 【【139】】 | rien | low | ritournelle- |
| 35 | 【【140】】 | structuraliste | low | ? Essentiellement un |
| 35 | 【【141】】 | contingents | low | existentiels s'instaurant au |
| 35 | 【【147】】 | formellement | low | surplombant l' |
| 35 | 【【153】】 | coignit | low | puissent concourir à l' |
| 35 | 【【154】】 | parfaits | low | commun qui, loin de s'instuerant une |
| 35 | 【【155】】 | existentiels | low | deficiatrice d'un |
| 35 | 【【155】】 | hautement | low | deficiatrice d'un |
| 35 | 【【155】】 | enrichissantes | low | deficiatrice d'un |
| 35 | 【【164】】 | véritablement | low | . Elle constitue le |
| 35 | 【【166】】 | seraient | low | linguistique et semiotique. Et s'il |
| 35 | 【【166】】 | avisés | low | linguistique et semiotique. Et s'il |
| 35 | 【【170】】 | qu'ils | low | de substituer des |
| 35 | 【【172】】 | s'accroit | low | catégorielles qui dominate les |
| 35 | 【【188】】 | existentiel | low | traditionnel des |
| 35 | 【【189】】 | Hjelmsel | low | semantiques et |
| 35 | 【【190】】 | souligné | low | d'enfermer les deux |
| 35 | 【【191】】 | autres | low | existentiel dans un troisième |
| 35 | 【【192】】 | semiotiques | low | qui serait étiqueté : |
| 35 | 【【204】】 | détails | low | . L'aura benjaminienne l' |
| 35 | 【【204】】 | queloquefois | low | . L'aura benjaminienne l' |
| 35 | 【【207】】 | mornes | low | singularisante. C'est encore alle qui confère son |
| 35 | 【【210】】 | aura | low | qui traverse les |
| 35 | 【【221】】 | s'affirme | low | déclencher la |
| 35 | 【【226】】 | autres | low | problématiques, qui opèrent aussi bien dans le |
| 35 | 【【228】】 | première | low | existentiels, dans ce |
| 35 | 【【231】】 | celui-ci | low | orthodoxe n'a pas pour |
| 35 | 【【232】】 | visagièreit | low | première de représenter le |
| 35 | 【【233】】 | qu'elle | low | , mais d'ouvrir à un |
| 35 | 【【233】】 | shifter | low | , mais d'ouvrir à un |
| 35 | 【【234】】 | changer | low | le faisant entrer en |
| 35 | 【【235】】 | superposent | low | directe avec celui-ci. La |
| 35 | 【【238】】 | conjugale | low | de « changer de |
| 35 | 【【238】】 | domestique | low | de « changer de |
| 35 | 【【238】】 | ethnique | low | de « changer de |
| 35 | 【【238】】 | etc | low | de « changer de |
| 35 | 【【238】】 | autre | low | de « changer de |
| 35 | 【【239】】 | apposée | low | superposent les |
| 35 | 【【243】】 | pouvoir | low | , apposée sur un |
| 35 | 【【243】】 | qu'elle | low | , apposée sur un |
| 35 | 【【252】】 | affect | low | humaines, en particulier la |
| 35 | 【【252】】 | christique | low | humaines, en particulier la |
| 35 | 【【252】】 | affect | low | humaines, en particulier la |
| 35 | 【【252】】 | debusysse | low | humaines, en particulier la |
| 35 | 【【252】】 | affect | low | humaines, en particulier la |
| 35 | 【【252】】 | léniniste | low | humaines, en particulier la |
| 35 | 【【254】】 | engageant | low | élémentaire. Mais il existe des |
| 36 | 【【8】】 | Léon | medium | n'était jamais parvu à véritablement franchir le seul de |
| 36 | 【【9】】 | seul | medium | collectif que fu le |
| 36 | 【【49】】 | individuation | medium | ! mais ouvertes. • |
| 36 | 【【79】】 | *psy* | medium | passivement subi. C'est une |
| 36 | 【【168】】 | perpetuel | medium | et des sues duvets. La |
| 36 | 【【246】】 | rénchantement | low | collectifs à l' |
| 36 | 【【248】】 | équivaloir | low | existentelles? Bien que l'actuelle |
| 36 | 【【248】】 | généralisé | low | existentelles? Bien que l'actuelle |
| 38 | 【【82】】 | militante | medium | sur commande personnelle d' |
| 38 | 【【178】】 | piles | medium | . Mais c'est étui oblier que |
| 45 | 【【90】】 | blanc | medium | , ils évoluent autour d'un |
| 45 | 【【99】】 | inanimées | medium | , associant |
| 45 | 【【112】】 | ontologique | low | m'appuyant sur cette première * |
| 45 | 【【113】】 | dernier | low | *, pour montrer que le |
| 45 | 【【122】】 | citirement | low | , en particulier, a pu être compré à deux |
| 45 | 【【123】】 | floue | low | . De quelque |
| 45 | 【【125】】 | aura | low | , citirement et |
| 45 | 【【129】】 | significante | low | déterminante pour l' |
| 45 | 【【129】】 | génératrice | low | déterminante pour l' |
| 45 | 【【129】】 | dites | low | déterminante pour l' |
| 45 | 【【131】】 | chaines | low | . Mais où localiser, dans ces |
| 45 | 【【131】】 | discursives | low | . Mais où localiser, dans ces |
| 45 | 【【135】】 | autres | low | ou dans les chaines discursives d' |
| 45 | 【【147】】 | cultures | low | Dés la première, se trouve réaffirme l' |
| 45 | 【【148】】 | a-signifiante | low | polyvocie des |
| 45 | 【【151】】 | fonctionnelle | low | , vehiculant des |
| 45 | 【【153】】 | auucie | low | cultures, et |
| 45 | 【【156】】 | Surtout | low | structural, ne sauraient comprometre l' |
| 45 | 【【166】】 | simple | low | , même lorsqu'elles deviennent bruyamment à la |
| 45 | 【【177】】 | abstraites | low | esthétique de |
| 45 | 【【181】】 | existentialiste | low | , que je qualifieraise de |
| 45 | 【【183】】 | sensible | low | , dissociant et rassembler les |
| 45 | 【【199】】 | certaines | medium | renvoie également dans l' |
| 45 | 【【201】】 | certaines | low | oubliée même, elle ignore le |
| 45 | 【【204】】 | certaines | low | ; c'est pourquoi la |
| 45 | 【【217】】 | nous-mêmes | low | ennociacies. On le |
| 45 | 【【223】】 | formelle | low | , qui nous regardait dans nous voir, tentait d'établir une |
| 45 | 【【223】】 | registre | low | , qui nous regardait dans nous voir, tentait d'établir une |
| 45 | 【【224】】 | significatifs | low | se déroulant dans la |
| 45 | 【【226】】 | symboles | low | s'est distendu en |
| 46 | 【【33】】 | deux | medium | * va conjuguer, en les |
| 46 | 【【35】】 | exacerbé | medium | précédents. Le |
| 46 | 【【73】】 | visible | low | restreinte. Cette |
| 46 | 【【73】】 | autre | low | restreinte. Cette |
| 46 | 【【73】】 | celle-là | low | restreinte. Cette |
| 46 | 【【73】】 | franchement | low | restreinte. Cette |
| 46 | 【【73】】 | invisible | low | restreinte. Cette |
| 46 | 【【76】】 | Benoit | medium | . En me réferant au |
| 46 | 【【79】】 | fractal | low | * . On se rappelle qu'un |
| 46 | 【【84】】 | cadres | medium | stochastique. Il convient selon moi, d'élargir l' |
| 46 | 【【84】】 | géométriques | medium | stochastique. Il convient selon moi, d'élargir l' |
| 46 | 【【84】】 | physiques | low | stochastique. Il convient selon moi, d'élargir l' |
| 46 | 【【89】】 | fractal | low | pourrait être considéré comme un |
| 46 | 【【91】】 | voir | low | a disposé sur sa |
| 46 | 【【92】】 | voisin | medium | processuels pour assurer notre voir. ( |
| 46 | 【【94】】 | téléguider | medium | ; en d'autres |
| 46 | 【【95】】 | possible | low | , téléguider, mettre en |
| 46 | 【【96】】 | seconde | low | et ouvrir à de nouvelles |
| 46 | 【【107】】 | surmoqué | low | a-signifiante de |
| 46 | 【【177】】 | partiels | low | : « pragmatique », le |
| 46 | 【【177】】 | transitionnels | low | : « pragmatique », le |
| 46 | 【【180】】 | existentielle | low | a signifiant génératrice d' |
| 46 | 【【191】】 | processuelle | low | visageiates, |
| 46 | 【【216】】 | timbres | low | fractales qui conduisirent la |
| 46 | 【【217】】 | transfigurés | low | moderne. Il laudrait aussi reprendre dans le |
| 46 | 【【223】】 | déterritorialisés | low | de l'ancien portant sur le |
| 46 | 【【224】】 | Prout | low | intervale « diaboloique », qui est venu artificiellement partager l' |

---

## 组 B-2：截断基本无实质内容，判定无需处理 (21 个)

这些截断原文只是功能词片段（冠词/介词/连词等），LLM 报的名词也不在其中。**判定为无漏提取，可直接丢弃这条 non-high 记录。**

| 批次 | 截断 | LLM误报名词 | 置信度 | 截断原文 |
|---|---|---|---|---|
| 3 | 【【37】】 | Esprit | medium | * , qui a marqué l' |
| 8 | 【【239】】 | signifant | medium | pour un autre |
| 10 | 【【74】】 | sociales | medium | , pour ne pas dire le |
| 11 | 【【86】】 | existentiels | low | »), et enfin, 1) les |
| 11 | 【【166】】 | programmées | low | » – tout la |
| 12 | 【【241】】 | san | medium | ni objet, pour |
| 19 | 【【181】】 | toutes | low | pour subir les |
| 19 | 【【231】】 | dialectables | low | se fait de la |
| 19 | 【【253】】 | autres | medium | que tous dans le |
| 19 | 【【253】】 | telle | medium | que tous dans le |
| 25 | 【【114】】 | amarres | low | • normal des |
| 25 | 【【114】】 | paradigmatiques | low | • normal des |
| 25 | 【【136】】 | deux | low | noun, sous l' |
| 35 | 【【177】】 | abstraits | low | qui fixent l' |
| 35 | 【【201】】 | punctum | low | geant aussi bien des |
| 35 | 【【203】】 | singularisante | low | où on lavait encore les |
| 35 | 【【203】】 | alle | low | où on lavait encore les |
| 46 | 【【82】】 | fixe | medium | tend à perdre tout |
| 46 | 【【123】】 | autre | medium | qui nous font pas d'une |
| 46 | 【【220】】 | musicale | low | égaux et, de ce |
| 46 | 【【220】】 | contemporaine | low | égaux et, de ce |
