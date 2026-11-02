Feature: Commission quote form

  The browser calls the BFF only. The vendor key and the vendor URL stay on the server.

  Background:
    Given I open the quote form

  Scenario: A valid loan shows a quote
    When I enter loan amount "10000", term "12", and risk band "LOW"
    And I click Generate Quote
    Then I see the quote for a 10000 loan at LOW
    And the page does not show the api key, a stack, or the vendor URL

  Scenario: An invalid amount does not call the BFF
    When I enter loan amount "0", term "12", and risk band "LOW"
    And I click Generate Quote
    Then I see the amount error beside the field
    And the browser did not call the BFF
    And the page does not show the api key, a stack, or the vendor URL

  Scenario: Loading appears and then the quote replaces it
    When I enter loan amount "10000", term "12", and risk band "LOW"
    And the next quote response is slow
    And I click Generate Quote
    Then I see the loading text
    And I see the quote for a 10000 loan at LOW

  Scenario: Tab and Enter submit a valid quote
    When I tab through the fields and enter a valid loan
    And I press Enter
    Then I see the quote for a 10000 loan at LOW

  Scenario: A narrow phone keeps the quote in one column
    Given the viewport is 390 by 844
    When I enter loan amount "10000", term "12", and risk band "LOW"
    And I click Generate Quote
    Then I see the quote for a 10000 loan at LOW
    And the page does not scroll sideways
