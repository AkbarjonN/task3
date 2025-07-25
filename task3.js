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

  async getUserNumber(max) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q) => new Promise(res => rl.question(q, res));
    let val;
    while (true) {
      let answer = await question(`Enter a number between 0 and ${max - 1}: `);
      if (/^\d+$/.test(answer)) {
        val = Number(answer);
        if (val >= 0 && val < max) break;
      }
      console.log("Invalid input, try again.");
    }
    rl.close();
    return val;
  }

  async play() {
    console.log("Welcome to the non-transitive dice game!");
    this.printDice();

    console.log("\nDeciding who selects dice first...");
    const userNum = await this.getUserNumber(2);
    const compNum = crypto.randomInt(0, 2);
    const result = (userNum + compNum) % 2;
    const userFirst = result === 0;

    console.log(`Your number: ${userNum}`);
    console.log(`Computer's number: ${compNum}`);
    console.log(`Result (mod 2): ${result}`);
    console.log(userFirst ? "You select dice first." : "Computer selects dice first.");

    let userDice, compDice;
    if (userFirst) {
      userDice = await this.selectDice(null);
      const choices = this.dice.map((_, i) => i).filter(i => i !== userDice);
      compDice = choices[crypto.randomInt(0, choices.length)];
      console.log(`Computer selects Dice #${compDice + 1}`);
    } else {
      compDice = crypto.randomInt(0, this.dice.length);
      console.log(`Computer selects Dice #${compDice + 1}`);
      userDice = await this.selectDice(compDice);
    }

    console.log(`Your dice: #${userDice + 1}`);
    console.log(`Computer dice: #${compDice + 1}`);

    console.log("\nYour turn to roll...");
    const userRollIdx = crypto.randomInt(0, this.dice[userDice].faces.length);
    console.log(`You rolled face: ${this.dice[userDice].faces[userRollIdx]}`);

    console.log("\nComputer's turn to roll...");
    const compRollIdx = crypto.randomInt(0, this.dice[compDice].faces.length);
    console.log(`Computer rolled face: ${this.dice[compDice].faces[compRollIdx]}`);

    const userVal = this.dice[userDice].faces[userRollIdx];
    const compVal = this.dice[compDice].faces[compRollIdx];

    if (userVal > compVal) {
      console.log("\nYou win!");
    } else if (userVal < compVal) {
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

