// ⚗️ Chem Balance Web - Professional Auto Balancer
// Full version with auto product suggestion & equation balancing

const input = document.getElementById("equationInput");
const button = document.getElementById("balanceBtn");
const resultBox = document.getElementById("result");

button.addEventListener("click", () => {
  const equation = input.value.trim();
  if (!equation.includes("->")) {
    resultBox.innerHTML = `<p style="color:red;">❌ Please include '->' to separate reactants and products.</p>`;
    return;
  }

  let [left, right] = equation.split("->").map(s => s.trim());
  if (!left) {
    resultBox.innerHTML = `<p style="color:red;">⚠️ No reactants found. Please enter a valid equation.</p>`;
    return;
  }

  if (!right) {
    // 🧪 coba prediksi produk otomatis
    const suggestion = suggestProducts(left);
    if (suggestion) {
      right = suggestion;
      resultBox.innerHTML = `<p>🧪 Predicted products: <strong>${right}</strong></p>`;
    } else {
      resultBox.innerHTML = `<p style="color:red;">⚠️ Incomplete equation. Please add both reactants and products.</p>`;
      return;
    }
  }

  try {
    const balanced = balanceEquation(`${left} -> ${right}`);
    resultBox.innerHTML += `<p>✅ Balanced equation:</p><p><strong>${balanced}</strong></p>`;
  } catch (e) {
    resultBox.innerHTML += `<p style="color:red;">⚠️ Unable to balance this equation. Please check your input.</p>`;
    console.error(e);
  }
});

/* ---------- Auto Product Suggestion ---------- */
function suggestProducts(leftSide) {
  const reactants = leftSide.split("+").map(s => s.trim());

  // 1️⃣ Asam + Basa
  if (reactants.some(r => r.includes("H")) && reactants.some(r => r.includes("OH"))) {
    const metal = reactants.find(r => /[A-Z][a-z]?\w*OH/.test(r))?.replace("OH", "") || "Na";
    const acid = reactants.find(r => /^H[A-Z]/.test(r))?.replace("H", "") || "Cl";
    return `${metal}${acid} + H2O`;
  }

  // 2️⃣ Logam + Asam
  if (reactants.some(r => /(Na|K|Ca|Mg|Zn|Fe)/.test(r)) && reactants.some(r => /^H[A-Z]/.test(r))) {
    const metal = reactants.find(r => /(Na|K|Ca|Mg|Zn|Fe)/.test(r));
    const acid = reactants.find(r => /^H[A-Z]/.test(r))?.replace("H", "");
    return `${metal}${acid} + H2`;
  }

  // 3️⃣ Hidrokarbon + O2 (reaksi pembakaran)
  if (reactants.some(r => /^C\d*H\d*$/.test(r)) && reactants.some(r => r === "O2")) {
    return "CO2 + H2O";
  }

  // 4️⃣ Oksida logam + Air
  if (reactants.some(r => /(Na2O|CaO|MgO)/.test(r)) && reactants.includes("H2O")) {
    const metal = reactants.find(r => /(Na2O|CaO|MgO)/.test(r)).replace("O", "");
    return `${metal}(OH)2`;
  }

  // 5️⃣ Oksida nonlogam + Air
  if (reactants.some(r => /(CO2|SO2|SO3|N2O5)/.test(r)) && reactants.includes("H2O")) {
    const oxide = reactants.find(r => /(CO2|SO2|SO3|N2O5)/.test(r));
    if (oxide === "CO2") return "H2CO3";
    if (oxide === "SO2") return "H2SO3";
    if (oxide === "SO3") return "H2SO4";
    if (oxide === "N2O5") return "HNO3";
  }

  return null; // tidak ditemukan pola umum
}

/* ---------- Balancer Core Logic ---------- */
function balanceEquation(equation) {
  const [left, right] = equation.split("->").map(side => side.trim());
  const leftCompounds = left.split("+").map(s => s.trim());
  const rightCompounds = right.split("+").map(s => s.trim());
  const allCompounds = [...leftCompounds, ...rightCompounds];

  // Parse all elements
  const elements = new Set();
  allCompounds.forEach(c => {
    for (const el of parseCompound(c).keys()) elements.add(el);
  });
  const elementList = Array.from(elements);

  // Build matrix
  const matrix = elementList.map(el => {
    return allCompounds.map((compound, i) => {
      const count = parseCompound(compound).get(el) || 0;
      return i < leftCompounds.length ? count : -count;
    });
  });

  // Solve for nullspace (Ax = 0)
  const coeffs = solveMatrix(matrix);

  // Normalize coefficients
  const lcmVal = lcmOfArray(coeffs.map(x => x.denominator));
  const normalized = coeffs.map(x => (x.numerator * lcmVal) / x.denominator);
  const gcdVal = gcdArray(normalized);
  const finalCoeffs = normalized.map(x => x / gcdVal);

  const leftEq = leftCompounds
    .map((c, i) => (finalCoeffs[i] === 1 ? "" : finalCoeffs[i]) + c)
    .join(" + ");
  const rightEq = rightCompounds
    .map((c, i) => (finalCoeffs[i + leftCompounds.length] === 1 ? "" : finalCoeffs[i + leftCompounds.length]) + c)
    .join(" + ");

  return `${leftEq} → ${rightEq}`;
}

/* ---------- Parse chemical formula ---------- */
function parseCompound(formula) {
  if (!formula) return new Map();
  const stack = [new Map()];
  const regex = /([A-Z][a-z]?|\(|\)|\d+)/g;
  const tokens = formula.match(regex);
  if (!tokens) return new Map();

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "(") {
      stack.push(new Map());
      i++;
    } else if (token === ")") {
      const group = stack.pop();
      i++;
      let multiplier = 1;
      if (i < tokens.length && /^\d+$/.test(tokens[i])) {
        multiplier = parseInt(tokens[i]);
        i++;
      }
      const top = stack[stack.length - 1];
      for (const [el, count] of group.entries()) {
        top.set(el, (top.get(el) || 0) + count * multiplier);
      }
    } else if (/^[A-Z][a-z]?$/.test(token)) {
      let count = 1;
      if (i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1])) {
        count = parseInt(tokens[i + 1]);
        i += 2;
      } else {
        i++;
      }
      const top = stack[stack.length - 1];
      top.set(token, (top.get(token) || 0) + count);
    } else {
      i++;
    }
  }
  return stack[0];
}

/* ---------- Fraction & Math helpers ---------- */
class Fraction {
  constructor(n, d = 1) {
    const g = gcd(Math.abs(n), Math.abs(d));
    this.numerator = n / g;
    this.denominator = d / g;
  }
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
function gcdArray(arr) {
  return arr.reduce((a, b) => gcd(a, b));
}
function lcm(a, b) {
  return (a * b) / gcd(a, b);
}
function lcmOfArray(arr) {
  return arr.reduce((a, b) => lcm(a, b), 1);
}

/* ---------- Matrix Solver (Nullspace method) ---------- */
function solveMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  let M = matrix.map(r => r.map(c => new Fraction(c)));

  let row = 0;
  for (let col = 0; col < cols && row < rows; col++) {
    let pivot = row;
    while (pivot < rows && M[pivot][col].numerator === 0) pivot++;
    if (pivot === rows) continue;
    [M[row], M[pivot]] = [M[pivot], M[row]];
    const pivotVal = M[row][col];

    for (let j = col; j < cols; j++) {
      M[row][j] = new Fraction(M[row][j].numerator * pivotVal.denominator, M[row][j].denominator * pivotVal.numerator);
    }

    for (let i = 0; i < rows; i++) {
      if (i !== row && M[i][col].numerator !== 0) {
        const factor = M[i][col];
        for (let j = col; j < cols; j++) {
          const num =
            M[i][j].numerator * factor.denominator * pivotVal.denominator -
            M[row][j].numerator * factor.numerator * pivotVal.denominator;
          const den = M[i][j].denominator * factor.denominator * pivotVal.denominator;
          M[i][j] = new Fraction(num, den);
        }
      }
    }
    row++;
  }

  const solution = new Array(cols).fill(null).map(() => new Fraction(0));
  solution[cols - 1] = new Fraction(1);
  for (let i = rows - 1; i >= 0; i--) {
    let pivotCol = M[i].findIndex(x => x.numerator !== 0);
    if (pivotCol === -1) continue;
    let sum = new Fraction(0);
    for (let j = pivotCol + 1; j < cols; j++) {
      sum = new Fraction(
        sum.numerator * solution[j].denominator * M[i][j].denominator -
        solution[j].numerator * M[i][j].numerator * sum.denominator,
        sum.denominator * solution[j].denominator * M[i][j].denominator
      );
    }
    solution[pivotCol] = new Fraction(-sum.numerator, sum.denominator);
  }

  return solution;
}
