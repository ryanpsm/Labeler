#!/usr/bin/env node
'use strict'

// Require: Packages
const meow = require('meow')
const updateNotifier = require('update-notifier')

// Require: Libs
const inquirer = require('./lib/inquirer')
const config = require('./lib/configstore')
const echo = require('./lib/echo')
const helper = require('./lib/helper')

// Require: Files
const pkg = require('./package.json')

// Variables
const helpText = `
NAME
    labeler - Label manager for GitHub repositories.

SYNOPSIS
    labeler [OPTIONS]

DESCRIPTION
    Create custom labels on GitHub repositories automatically.
    This CLI helps you organize your GitHub labels by storing them in a labels.json file. You can add new labels through the CLI with the -n flag.
    Whenever you create a new repository, instead of manually uploading your labels, use this CLI to have it done automatically!

OPTIONS
    -h, --help
        Display this help page.

    -c, --config
        Launch interactive CLI to store data into config. Storing empty strings removes data from config.

    -n, --new-label
        Launch interactive CLI to store new labels in the labels.json file.

    -r, --repository [REPOSITORY]
        Specify GitHub repository name. If not specified uses values in config, else ignores config.

    -o, --owner [OWNER]
        Specify owner of repository. If not specified uses values in config, else ignores config.

    -t, --token [TOKEN]
        Specify personal access token. If not specified uses values in config, else ignores config.

    -H, --host [HOST]
        Specify host. If not specified uses values in config, else ignores config.

    -f, --force
        Ignore user confirmation.

    -d, --delete-all-labels
        Delete all existing labels in repository.

    -u, --upload-labels
        Upload custom labels to repository. Skips already existing labels.

    -e, --empty-labels-file
        Remove every label from the labels.json file.

    -R, --reset-labels-file
        Reset labels.json by overwriting labels.json with the default labels.

    -p, --path
        Return the path for labels.json file.

EXAMPLES
    Delete all labels from the repository and upload custom ones stored under labels.json to the repository:
        labeler -dur Labeler

    Same as above but without the confirmation questions:
        labeler -fdur Labeler

    Delete every label from labels.json and add new labels to it:
        labeler -en

    Using GitHub Enterprise hosts:
        labeler -dur Labeler -H github.yourhost.com
`;

// Meow CLI
const cli = meow(helpText, {
    description: false,
    flags: {
        'help': {
            alias: 'h',
            type: 'boolean'
        },
        'config': {
            alias: 'c',
            type: 'boolean'
        },
        'repository': {
            alias: 'r',
            type: 'string'
        },
        'owner': {
            alias: 'o',
            type: 'string'
        },
        'host': {
            alias: 'H',
            type: 'string'
        },
        'token': {
            alias: 't',
            type: 'string'
        },
        'delete-all-labels': {
            alias: 'd',
            type: 'boolean'
        },
        'new-label': {
            alias: 'n',
            type: 'boolean'
        },
        'upload-labels': {
            alias: 'u',
            type: 'boolean'
        },
        'force': {
            alias: 'f',
            type: 'boolean'
        },
        'empty-labels-file': {
            alias: 'e',
            type: 'boolean'
        },
        'reset-labels-file': {
            alias: 'R',
            type: 'boolean'
        },
        'path': {
            alias: 'p',
            type: 'boolean'
        }
    }
})

/* --- Start --- */
console.log()

// Update Notifier
updateNotifier({ pkg }).notify({ isGlobal: true })

// Variables
const token = helper.assignFlag(cli, 'token')
const owner = helper.assignFlag(cli, 'owner')
const repository = helper.assignFlag(cli, 'repository')
const host = helper.assignFlag(cli, 'host')

// Main function
async function main() {
    // Warn user if -f
    if (cli.flags.force) echo.warning('Detected -f, ignoring user confirmation.\n')

    // Check if flags were called correctly
    helper.checkFlags(cli)

    // Check for -d or -u
    if (cli.flags.deleteAllLabels || cli.flags.uploadLabels) helper.echoOwnerRepository(owner, repository)

    // Run functions according to flags
    if (cli.flags.path) helper.labelsPath() // Return labels.json path
    if (cli.flags.resetLabelsFile) await helper.resetLabelsFile(cli) // Reset labels.json file
    if (cli.flags.emptyLabelsFile) await helper.emptyLabelsFile(cli) // Delete all labels from labels.json
    if (cli.flags.deleteAllLabels) await helper.deleteAllLabels(token, owner, host, repository, cli) // Delete all labels from repository
    if (cli.flags.uploadLabels) await helper.uploadLabels(token, owner, host, repository, cli) // Upload custom labels to repository
    if (cli.flags.config) await helper.cliConfig() // Run the interactive config CLI
    // Run the interactive "create new label" CLI
    if (cli.flags.newLabel) {
        echo.tip('If you want to edit the file, here\'s the path:')
        echo.info(config.path('labels'))
        console.log()

        // Ask if the user wants a fresh file or not
        if (!cli.flags.force && !cli.flags.emptyLabelsFile) {
            const answerFresh = await inquirer.choiceFreshNewLabels()
            if (answerFresh) config.set('labels', { 'labels': [] })
            console.log()
        }

        echo.info('Create new labels:')
        await helper.cliNewLabel(cli)
    }
    if (cli.input[0] == "secret") echo.rainbow() // :)

    // If any of these flags is true, exit (these are the ones that can always be called, no matter what)
    if (cli.flags.resetLabelsFile || cli.flags.path) process.exit()

    // If nothing happens, I'm assuming the user ran without flags
    echo.error('Missing arguments.')
    echo.tip('Use -h for help.')
    echo.info('Running version ' + pkg.version + '.', true)
}

// Call main()
main()
