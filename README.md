# Computer Cart Management Kiosk

This repository contains the single-page HTML file used to power the computer cart checkout kiosk. The page is designed to be run in a locked-down kiosk mode on a Chromebook, providing a seamless and dedicated interface for checking out laptops.

### Project Goals

The primary goal of this project is to create a reliable and secure system that:
* Displays both the computer cart's availability calendar and the checkout form on a single screen.
* Prevents users from closing the windows or navigating to other websites.
* Automatically launches upon the device's startup, eliminating the need for a user to log in or manually open the page.

### Getting Started

To set up a Chromebook with this kiosk page, follow these steps:

1.  **Clone the Repository:** Clone this repository to your local machine.
2.  **Host the `index.html` File:** Upload the `index.html` file to a reliable web hosting service (such as GitHub Pages or a school-managed server).
3.  **Obtain the Public URL:** Get the public-facing URL for the hosted file (e.g., `https://your-username.github.io/your-repo-name/index.html`).
4.  **Configure Kiosk Mode:** Using the Google Admin Console for the `harfordchristian.org` domain, configure a kiosk application to automatically launch with the URL from the previous step.

### File Contents

`index.html` is a simple HTML5 document that uses `flexbox` for a two-column layout. It embeds a Google Calendar and a Google Form using `<iframe>` tags.

### Maintenance

* **To Update the Calendar:** Adjust the sharing settings and public URL for the Google Calendar in its own settings menu. The `CartCheckIn.html` file does not need to be changed unless the embed URL itself changes.
* **To Update the Form:** Adjust the Google Form in its own editing interface. The changes will automatically be reflected in the kiosk without any need to update the `CartCheckIn.html` file.
