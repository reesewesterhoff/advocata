# Overview

I am building a legislative review application. The idea is for the user to be able to enter search criteria to target a specific area of focus and paste in an API key for an AI of their choosing. Using this information the application will query the LegiScan API and return data matching their search. This data will then be sent to an AI and based on a prompt, analyze and summarize the LegiScan data and return a response to the user that will help them determine which bills are most relevant to them.

## Application flow

- A user visits the web application
- On the home page they are prompted to select from a few different dropdowns to narrow search criteria and paste in an API key for an AI of their choosing
- They submit the request which hits the LegiScan API and returns data matching their search criteria
- That data is then sent to the AI of their choosing for parsing and to determine which bills are most relevant to the user (the prompt for the AI interaction may be hardcoded or it may be a dynamic property passed in by the user).

## Page Layout

- Search criteria section - will be a mixture of dropdowns and free text inputs
- Raw data section - a table displaying the raw response from legiscan
- AI interpretation section - a table displaying the result from the AI ranking the legiscan responses by the most to least relevant to the user

## Tech
- I want this app to be as simple as possible and I want to leverage Node's ability to function as a server and also it's ability to serve front end pages for the UI
- Refer to .cursor/rules/rules.mdc for other tech specs
