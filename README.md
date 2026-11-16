 # TripSplit

**Video Demo:** [Add video link here]

**Live Site:** https://shahil-prajapati.github.io/TripSplit/

**Author:** Shahil Prajapati (GitHub: [shahil-prajapati](https://github.com/shahil-prajapati))

## Description

TripSplit is a web application that helps a group of friends keep track of shared trip expenses and work out who owes whom.

Anyone who has been on a group trip knows the problem: one person books the villa, another pays for fuel, a third buys dinner, and at the end nobody is sure how to settle up fairly.

TripSplit records every expense, calculates each person's balance, and suggests a short list of payments that settles the whole group.

It is built with plain HTML, CSS and JavaScript, with no frameworks and no backend. All data is stored in the browser using `localStorage`.

## Features

- **Trips:** Create a trip with a name, an emoji and a list of friends. Your profile name is added automatically as the first member, and duplicate names are removed. You can add members later and delete a trip.
- **Expenses:** Add, edit and delete expenses with a title, amount, date, category, payer and participants. Expenses can be searched by title or category name.
- **Categories:** Seven default categories (Stay, Food, Fuel, Transport, Shopping, Fun, Other), plus custom categories that you create inside the expense form. Custom categories are saved and shared across all trips.
- **Three split types:** Split expenses equally, by custom amounts, or by percentages. The form checks that custom amounts add up to the total and percentages add up to 100.
- **Balances:** See what each member paid, their share, and whether they should receive or pay money.
- **Settle up:** Suggested payments, a "Mark paid" button, an undo button and payment history. Confetti appears when everyone is settled.
- **Summary:** Trip total, average per member, top payer and spending breakdown by category.
- **Home dashboard:** Number of trips, total spent, your overall balance and your five most recent expenses.
- **Notifications:** An in-app log of actions such as trips created and payments recorded.
- **Profile:** Change your name, switch on "Calm mode", export your data as a JSON file, or reset everything.

## How It Works

The whole app state lives in one JavaScript object, `S`, containing the profile, trips, notifications and custom categories. Each trip holds its members, expenses and recorded settlements.

Every change follows the same pattern: update `S`, call `save()` to write it to `localStorage` under the key `tripsplit.v1`, then call `render()` to redraw the screen. If nothing is saved yet, `load()` creates a demo trip so the app is never empty.

To calculate balances, `calc()` adds up what each member paid and what each owes through their shares. A member's net balance is paid minus owed, adjusted by any recorded settlements. A positive balance means the person should get money back, and a negative balance means they owe money.

`suggest()` repeatedly matches the person who owes the most with the person who is owed the most, so a group of n people never needs more than n − 1 payments.

Equal splits are done in paise (hundredths of a rupee) so the shares always add up exactly to the amount, with any leftover paise given to the first people. In percentage mode, the last person receives the remainder so the total is never off by rounding.

## Design Choices

- **localStorage instead of a database:** TripSplit needs no account or server, so it works instantly and offline. The trade-off is that data stays in one browser on one device. I kept `load()` and `save()` as the only functions that touch storage, so a cloud backend could replace them later.
- **One click listener:** Buttons carry a `data-a` attribute naming an action, and a single listener on the document runs the matching function. This keeps the code short and means screens that are redrawn keep working without reattaching listeners.
- **Safe output:** Every user-entered name is passed through an `esc()` function before being placed in HTML.
- **Look and feel:** A dark glassmorphism design with blurred glowing background shapes, a bottom navigation bar and a subtle 3D tilt on cards. Calm mode and the system "reduce motion" setting turn the motion off.
- **Responsive layout:** CSS grid and flexbox adapt the layout to phones and desktops.

## File Structure

- `index.html`: The page skeleton, with the header, main container, bottom navigation and a container for pop-up forms.
- `styles.css`: All colours, layout, buttons, forms, navigation, pop-ups and animations.
- `script.js`: All logic, in six commented sections (data layer, helpers, calculations, views, forms, actions and start-up).
- `README.md`, `LICENSE` and `.gitignore`.

## Installation and Usage

There is nothing to install and no internet connection is required.

1. Download or clone the repository:
   `git clone https://github.com/shahil-prajapati/TripSplit.git`
2. Open `index.html` in a modern browser, or visit the live site above.
3. Click **＋ New trip**, enter a name and your friends' names, and create it.
4. Open the trip, click **＋ Add** and enter an expense. Use **＋ New category** if you need a category that doesn't exist yet.
5. Check the Balances tab, then use Settle to record payments.

## Limitations

TripSplit has no sign-in, cloud sync or push notifications, so data is not shared between devices. It cannot import an exported file, and it does not let you remove a member or a custom category.
