// Require: Packages
const clear = require('clear')
const chalk = require('chalk')

// Require: Libs
const inquirer = require('./inquirer')
const config = require('./configstore')
const axios = require('./axios')
const echo = require('./echo')

// Require: Files
const pkg = require('../package.json')

// Echo the owner and repository
function echoOwnerRepository(owner, repository) {
    echo.owner(owner)
    echo.repository(repository)
    console.log()
}

// Returns flag from arguments, or from config
function assignFlag(cli, flag) {
    if (cli.flags.hasOwnProperty(flag)) return cli.flags[flag]
    else if (config.has('config', flag)) return config.get('config', flag)
    else {
        if (flag == 'host') return pkg.labeler.defaultHost
        else return null
    }
}

// Echos the path for labels.json
function labelsPath() {
    echo.info('Path for labels.json')
    echo.info(config.path('labels'))
    console.log()
}

// Censor config
function censorConfig(config) {
    if (config.token) config.token = config.token.replace(/^.{36}/g, '*'.repeat(36))
    return config
}

// Check required flags
function checkRequiredFlags(token, owner, repository) {
    if (!token && !owner && !repository) {
        echo.error('Missing arguments.')
        echo.tip('Use -h for help.', true)
    } else if (!token) {
        echo.error('You need to specify a token!')
        echo.tip('Use the -t flag.', true)
    } else if (!owner) {
        echo.error('You need to specify an owner!')
        echo.tip('Use the -o flag.', true)
    } else if (!repository) {
        echo.error('You need to specify a repository!')
        echo.tip('Use the -r flag.', true)
    }
}

// Check flags
function checkFlags(cli) {
    // console.log(cli.flags)
    // All flags to copy easily (without cli.flags.force and cli.flags.help)
    // cli.flags.repository cli.flags.token cli.flags.owner cli.flags.host cli.flags.uploadLabels cli.flags.deleteAllLabels cli.flags.newLabel cli.flags.config cli.flags.emptyLabelsFile cli.flags.resetLabelsFile

    // Check for usage of flags that shouldn't be used together
    // If (((Flags) && (Flags)) || (cli.flags.config && cli.flags.newLabel) || (cli.flags.emptyLabelsFile && (Flags)))
    if (((cli.flags.repository || cli.flags.token || cli.flags.owner || cli.flags.host || cli.flags.uploadLabels || cli.flags.deleteAllLabels) && (cli.flags.newLabel || cli.flags.config))
        || (cli.flags.config && cli.flags.newLabel)
        || (cli.flags.emptyLabelsFile && (cli.flags.repository || cli.flags.token || cli.flags.owner || cli.flags.host || cli.flags.uploadLabels || cli.flags.deleteAllLabels || cli.flags.config || cli.flags.resetLabelsFile))) {
        echo.error('Wrong usage.')
        echo.tip('Use -h for help.', true)
    }
}

// Deletes labels.json and creates it again with default values from labels.json
async function resetLabelsFile(cli) {
    // Ask if the user is sure
    if (!cli.flags.force) {
        const answer = await inquirer.confirmResetLabels()
        if (!answer.resetLabels) {
            console.log()
            echo.abort('Reset labels.json.', true)
        }
    }

    // Reset labels
    echo.info('Resetting labels.json...')
    config.resetLabels()
    echo.success('Done!\n')
}

// Empties all labels from labels.json
async function emptyLabelsFile(cli) {
    // Ask if the user is sure
    if (!cli.flags.force) {
        const answer = await inquirer.confirmEmptyLabels()
        if (!answer.emptyLabels) {
            console.log()
            echo.abort('Delete labels from labels.json.', true)
        }
    }

    // Empty labels.json
    echo.info('Emptying labels.json...')
    config.set('labels', { 'labels': [] })
    if (cli.flags.newLabel) echo.success('Done.\n')
    else echo.success('Done.\n', true)
}

// Upload all labels from labels.json
async function uploadLabels(token, owner, host, repository, cli) {
    // Check required Flags
    checkRequiredFlags(token, owner, repository)

    // Variables
    labels = config.getAll('labels')

    // Ask if the user is sure
    if (!cli.flags.force) {
        const answer = await inquirer.confirmUploadLabels()
        if (!answer.uploadLabels) {
            console.log()
            echo.abort('Upload labels to ' + repository + '.', true)
        }
    }
    echo.info(chalk.bold('Uploading labels to ' + repository + '...'))

    // Variables
    let arrayPromises = []

    // Push promises (that upload labels) to an array
    for (let i in labels) arrayPromises.push(axios.saveLabel(false, token, owner, host, repository, labels[i]))

    // Run promises (aka upload all labels)
    await Promise.all(arrayPromises)

    // Done
    echo.success('Done!\n')
    echo.success('Finished!', true)
}

// Deletes all labels from a repository
async function deleteAllLabels(token, owner, host, repository, cli) {
    // Check required Flags
    checkRequiredFlags(token, owner, repository)

    // Ask if the user is sure
    if (!cli.flags.force) {
        const answer = await inquirer.confirmDeleteAllLabels()
        if (!answer.deleteAllLabels) {
            console.log()
            echo.abort('Delete labels from ' + repository + '.', true)
        }
    }
    echo.info(chalk.bold('Deleting labels from ' + repository + '...'))

    // Variables
    let arrayPromises = []

    // Get all labels form repository
    const allLabels = await axios.getLabels(true, token, owner, host, repository)

    // Push promises (that delete labels) to an array
    for (let i in allLabels.data) arrayPromises.push(axios.deleteLabel(false, token, allLabels.data[i]))

    // Run promises (aka delete all labels)
    await Promise.all(arrayPromises)

    // Done
    if (cli.flags.uploadLabels) echo.success('Done!\n')
    else {
        console.log()
        echo.success('Finished!', true)
    }
}

// Opens the interactive config CLI
async function cliConfig() {
    // Clear
    clear()

    // Display current config
    echo.info("Current config:")
    console.log(censorConfig(config.getAll('config')))
    console.log()

    // Get config input from user
    let answer = await inquirer.config()

    // Check input
    if (answer) {
        if (answer.hasOwnProperty('token')) {
            // Token
            if (answer.token) config.set('config', answer)
            else config.remove('config', 'token')
        } else if (answer.hasOwnProperty('owner')) {
            // Owner
            if (answer.owner) config.set('config', answer)
            else config.remove('config', 'owner')
        } else if (answer.hasOwnProperty('repository')) {
            // Repository
            if (answer.repository) config.set('config', answer)
            else config.remove('config', 'repository')
        } else if (answer.hasOwnProperty('host')) {
            // Host
            if (answer.host) config.set('config', answer)
            else config.remove('config', 'host')
        } else {
            // Exit
            process.exit()
        }
    }

    // Call this function again until user exits
    await cliConfig()
}

// Opens the interactive "create new label" CLI
async function cliNewLabel(cli) {
    // Variables
    labels = config.getAll('labels')
    let dupe = false

    // Get config input from user
    let answer = await inquirer.newLabel()

    // Check for dupe
    for (let i in labels) {
        if (labels[i].name == answer.name) {
            dupe = true
            break
        }
    }

    // Save if not dupe
    if (!dupe) {
        labels.push(answer)
        config.set('labels', { 'labels': labels })
        echo.success('Saved label! Use Ctrl+C to exit.\n')
    } else echo.error('Label "' + answer.name + '" already exists! Please choose another name.\n')

    // Call this function again until user exits
    await cliNewLabel(cli)
}

// Exports
module.exports = {
    echoOwnerRepository: echoOwnerRepository,
    assignFlag: assignFlag,
    labelsPath: labelsPath,
    censorConfig: censorConfig,
    checkRequiredFlags: checkRequiredFlags,
    checkFlags: checkFlags,
    resetLabelsFile: resetLabelsFile,
    emptyLabelsFile: emptyLabelsFile,
    deleteAllLabels: deleteAllLabels,
    uploadLabels: uploadLabels,
    cliConfig: cliConfig,
    cliNewLabel: cliNewLabel
}
