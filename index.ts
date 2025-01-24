
import { sleep } from "./utils"


import { main_menu_display, rl, screen_clear, security_checks_display } from "./menu/menu";

import { create_Buy } from "./createBuy";
import { sellAll } from "./sellAll";
import { sell } from "./sell";
import { gather_wallet } from "./gather";


export const init = async () => {
  try {

    screen_clear();
    console.log("Pumpfun Token Launchpad Buy Bundler");

    main_menu_display();

    rl.question("\t[Main] - Choice: ", (answer: string) => {
      let choice = parseInt(answer);
      switch (choice) {
        case 1:
          create_Buy();
          break;
        case 2:
          sellAll()
          break;
        case 3:
          gather_wallet();
          break;
        case 4:
          process.exit(1);
          break;
        default:
          console.log("\tInvalid choice!");
          sleep(1500);
          init();
          break;
      }
    })
  } catch (error) {
    console.log(error)
  }
}

export const security_checks = () => {
  screen_clear();
  console.log("Security Checks")
  security_checks_display();
}

init()
