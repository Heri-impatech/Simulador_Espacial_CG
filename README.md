# Simulação de Campos Gravitacionais Coletivos e Colisões N-Corpos em Ambiente 3D Acelerada por Octrees

**Autor:** Herivelton Guilherme Alves de Siqueira
**Instituição:** IMPA Tech – Bacharelado em Matemática da Tecnologia e Inovação
**Data:** 28 de maio de 2026

---

## 📌 Visão Geral

Este projeto tem como objetivo o desenvolvimento de um motor de simulação física tridimensional interativo capaz de modelar a dinâmica de múltiplos corpos rígidos submetidos a interações gravitacionais e colisões elásticas.

Cada corpo possui propriedades físicas derivadas de sua geometria volumétrica, de modo que o tamanho do objeto determina diretamente sua massa. Corpos de maior massa exercem influência gravitacional significativa sobre os demais, alterando suas trajetórias de acordo com uma aproximação das leis da gravitação universal.

Além da atração gravitacional tradicional, o sistema foi projetado para permitir a parametrização de forças de repulsão, possibilitando diferentes cenários de simulação.

---

## 🎯 Objetivos

* Simular interações gravitacionais entre múltiplos corpos rígidos em um ambiente 3D.
* Detectar e resolver colisões elásticas em tempo real.
* Relacionar propriedades geométricas dos objetos às suas propriedades físicas.
* Permitir visualização interativa da dinâmica do sistema.
* Escalar a simulação para grandes quantidades de corpos utilizando estruturas espaciais eficientes.

---

## ⚙️ Desafios Computacionais

Uma implementação ingênua exige que cada corpo interaja com todos os demais, resultando em uma complexidade computacional de:

[
O(N^2)
]

Esse custo torna a execução em tempo real inviável para cenas com muitos objetos.

---

## 🌳 Otimização com Octrees

Para reduzir o custo computacional, o espaço tridimensional da simulação é organizado por meio de uma **Octree**, uma estrutura hierárquica que particiona recursivamente o espaço em oito sub-regiões (octantes).

Essa abordagem permite:

* Organizar eficientemente os corpos no espaço.
* Realizar consultas de vizinhança de forma rápida.
* Restringir cálculos de colisão e interações locais apenas aos objetos próximos.
* Reduzir significativamente o número de verificações necessárias.

Com essa estratégia, a complexidade média da simulação pode ser reduzida para aproximadamente:

[
O(N \log N)
]

tornando viável a execução em tempo real diretamente no navegador.

---

## 🧩 Principais Funcionalidades

* Simulação gravitacional N-corpos.
* Colisões elásticas tridimensionais.
* Cálculo de massa baseado em volume.
* Estrutura espacial baseada em Octree.
* Renderização 3D interativa.
* Execução otimizada para aplicações web.

---

## 🚀 Resultado Esperado

Ao final do projeto, espera-se obter um ambiente de simulação física capaz de representar sistemas gravitacionais complexos e colisões entre múltiplos corpos em tempo real, combinando precisão visual, interatividade e eficiência computacional.
