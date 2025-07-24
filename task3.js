
import crypto from "crypto";
import readline from "readline";

class Dice {
  constructor(faces) {
    if (!Array.isArray(faces) || faces.length < 1) throw new Error("Dice must have faces");
    this.faces = faces;
  }
}

class DiceParser {
  static parse(args) {
    if (args.length < 3) {
      throw new Error(`Error: Need at least 3 dice.\nExample:\nnode game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3`);
    }
    return args.map((arg, i) => {
      let faces = arg.split(",").map(x => {
        if (!/^\d+$/.test(x)) throw new Error(`Non-integer face in dice #${i + 1}`);
        return Number(x);
      });
      return new Dice(faces);
    });
  }
}

class FairRandom {
  constructor(range) {
    this.range = range;
    this.key = crypto.randomBytes(32);
    this.number = this.uniformRandom();
    this.hmac = this.calcHMAC(this.number);
  }
  uniformRandom() {
    const max = BigInt(this.range);
    const bytesNeeded = 4;
    while (true) {
      const rnd = BigInt("0x" + crypto.randomBytes(bytesNeeded).toString("hex"));
      if (rnd < (BigInt(2) ** BigInt(bytesNeeded * 8)) - ((BigInt(2) ** BigInt(bytesNeeded * 8)) % max)) {
        return Number(rnd % max);
      }
    }
  }
  calcHMAC(num) {
    const h = crypto.createHmac("sha3-256", this.key);
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(num);
    h.update(buf);
    return h.digest("hex");
  }
  showHMAC() {
    console.log("HMAC:", this.hmac);
  }
  reveal() {
    console.log("Key (hex):", this.key.toString("hex"));
    console.log("Computer number:", this.number);
  }
  async getUserNumber() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise(res => rl.question(q, res));
    let val;
    while (true) {
      let answer = await question(`Enter your number [0-${this.range - 1}]: `);
      if (/^\d+$/.test(answer)) {
        val = Number(answer);
        if (val >= 0 && val < this.range) break;
      }
      console.log("Invalid input, try again.");
    }
    rl.close();
    return val;
  }
  async getResult() {
    this.showHMAC();
    const userNum = await this.getUserNumber();
    this.reveal();
    return (userNum + this.number) % this.range;
  }
}

class Probability {
  static winProb(d1, d2) {
    let wins = 0, total = 0;
    for (let a of d1.faces) for (let b of d2.faces) {
      total++; if (a > b) wins++;
    }
    return wins / total;
  }
}

class Game {
  constructor(dice) {
    this.dice = dice;
  }
  printDice() {
    this.dice.forEach((d, i) => console.log(`Dice #${i + 1}: ${d.faces.join(",")}`));
  }
  async selectDice(exclude) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise(res => rl.question(q, res));
    while (true) {
      console.log("Select dice:");
      this.dice.forEach((d, i) => {
        if (i === exclude) console.log(` ${i + 1}) Dice #${i + 1} (taken)`);
        else console.log(` ${i + 1}) Dice #${i + 1}: ${d.faces.join(",")}`);
      });
      console.log(" h) Help");
      console.log(" e) Exit");
      const ans = await question("Choice: ");
      if (ans === "e") {
        rl.close();
        process.exit(0);
      }
      if (ans === "h") {
        rl.close();
        this.printProbabilityTable();
        continue;
      }
      const idx = Number(ans) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < this.dice.length && idx !== exclude) {
        rl.close();
        return idx;
      }
      console.log("Invalid choice.");
    }
  }
  printProbabilityTable() {
    console.log("\nWinning probabilities (%)");
    const n = this.dice.length;
    let header = "      ";
    for(let i=0; i<n; i++) header += ` D${i+1}   `;
    console.log(header);
    for (let i=0; i<n; i++) {
      let row = `D${i+1} | `;
      for (let j=0; j<n; j++) {
        if (i===j) row += "  -   ";
        else {
          let p = Probability.winProb(this.dice[i], this.dice[j]);
          row += (p*100).toFixed(1).padStart(5)+"% ";
        }
      }
      console.log(row);
    }
    console.log("");
  }
  async play() {
    console.log("Welcome to the non-transitive dice game!");
    this.printDice();

 
    console.log("\nDeciding who selects dice first...");
    const frp = new FairRandom(2);
    const firstUserNum = await frp.getResult();
    const firstSum = (frp.number + firstUserNum) % 2;
    let userFirst = firstSum === 0;
    console.log(`Result (mod 2): ${firstSum}`);
    console.log(userFirst ? "You select dice first." : "Computer selects dice first.");

    let userDice, compDice;

    if (userFirst) {
      userDice = await this.selectDice(null);

      compDice = [...Array(this.dice.length).keys()].filter(i => i !== userDice)[Math.floor(Math.random() * (this.dice.length - 1))];
      console.log(`Computer selects Dice #${compDice + 1}`);
    } else {
      compDice = Math.floor(Math.random() * this.dice.length);
      console.log(`Computer selects Dice #${compDice + 1}`);
      userDice = await this.selectDice(compDice);
    }

    console.log(`Your dice: #${userDice + 1}`);
    console.log(`Computer dice: #${compDice + 1}`);

 
    console.log("\nYour turn to roll...");
    const userRoll = new FairRandom(this.dice[userDice].faces.length);
    const userRollRes = await userRoll.getResult();
    console.log(`You rolled face: ${this.dice[userDice].faces[userRollRes]}`);


    console.log("\nComputer's turn to roll...");
    const compRoll = new FairRandom(this.dice[compDice].faces.length);
    compRoll.showHMAC();
    const compUserNum = await compRoll.getUserNumber();
    compRoll.reveal();
    const compRollRes = (compRoll.number + compUserNum) % this.dice[compDice].faces.length;
    console.log(`Computer rolled face: ${this.dice[compDice].faces[compRollRes]}`);


    if (this.dice[userDice].faces[userRollRes] > this.dice[compDice].faces[compRollRes]) {
      console.log("\nYou win!");
    } else if (this.dice[userDice].faces[userRollRes] < this.dice[compDice].faces[compRollRes]) {
      console.log("\nComputer wins!");
    } else {
      console.log("\nIt's a tie!");
    }
  }
}

(async () => {
  try {
    const dice = DiceParser.parse(process.argv.slice(2));
    const game = new Game(dice);
    await game.play();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
