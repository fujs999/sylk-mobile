// copyright AG Projects 2020-2021

import React, { Component, Fragment } from 'react';
import { Alert, View, SafeAreaView, ImageBackground, AppState, Linking, Platform, StyleSheet, Vibration, PermissionsAndroid} from 'react-native';
import { DeviceEventEmitter, BackHandler } from 'react-native';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { registerGlobals } from 'react-native-webrtc';
import { Router, Route, Link, Switch } from 'react-router-native';
import history from './history';
import Logger from "../Logger";
import autoBind from 'auto-bind';
import { firebase } from '@react-native-firebase/messaging';
import VoipPushNotification from 'react-native-voip-push-notification';
import uuid from 'react-native-uuid';
import { getUniqueId, getBundleId, isTablet, getPhoneNumber} from 'react-native-device-info';
import RNDrawOverlay from 'react-native-draw-overlay';
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import Contacts from 'react-native-contacts';
import BackgroundTimer from 'react-native-background-timer';
import DeepLinking from 'react-native-deep-linking';
import base64 from 'react-native-base64';
import SoundPlayer from 'react-native-sound-player';
import RNSimpleCrypto from "react-native-simple-crypto";
import OpenPGP from "react-native-fast-openpgp";

registerGlobals();

import * as sylkrtc from 'react-native-sylkrtc';
import InCallManager from 'react-native-incall-manager';
import RNCallKeep, { CONSTANTS as CK_CONSTANTS } from 'react-native-callkeep';

import RegisterBox from './components/RegisterBox';
import ReadyBox from './components/ReadyBox';
import Call from './components/Call';
import Conference from './components/Conference';
import FooterBox from './components/FooterBox';
import StatusBox from './components/StatusBox';
import ImportPrivateKeyModal from './components/ImportPrivateKeyModal';
import IncomingCallModal from './components/IncomingCallModal';
import LogsModal from './components/LogsModal';
import NotificationCenter from './components/NotificationCenter';
import LoadingScreen from './components/LoadingScreen';
import NavigationBar from './components/NavigationBar';
import Preview from './components/Preview';
import CallManager from './CallManager';
import SQLite from 'react-native-sqlite-storage';
//SQLite.DEBUG(true);
SQLite.enablePromise(true);

import xss from 'xss';
import moment from 'moment';
import momentFormat from 'moment-duration-format';
import utils from './utils';
import config from './config';
import storage from './storage';
var randomString = require('random-string');

const RNFS = require('react-native-fs');
const logfile = RNFS.DocumentDirectoryPath + '/logs.txt';

import styles from './assets/styles/blink/root.scss';
const backgroundImage = require('./assets/images/dark_linen.png');

const logger = new Logger("App");

function checkIosPermissions() {
    return new Promise(resolve => PushNotificationIOS.checkPermissions(resolve));
  }

const KeyOptions = {
  cipher: "aes256",
  compression: "zlib",
  hash: "sha512",
  RSABits: 4096,
  compressionLevel: 5
}


const theme = {
    ...DefaultTheme,
    dark: true,
    roundness: 2,
    colors: {
        ...DefaultTheme.colors,
       primary: '#337ab7',
    //   accent: '#f1c40f',
    },
};

const URL_SCHEMES = [
  'sylk://',
];

const ONE_SECOND_IN_MS = 1000;

const VIBRATION_PATTERN = [
    1 * ONE_SECOND_IN_MS,
    1 * ONE_SECOND_IN_MS,
    4 * ONE_SECOND_IN_MS
  ];


let bundleId = `${getBundleId()}`;
const deviceId = getUniqueId();

const version = '1.0.0';
const MAX_LOG_LINES = 300;


if (Platform.OS == 'ios') {
    bundleId = `${bundleId}.${__DEV__ ? 'dev' : 'prod'}`;
    //bundleId = 'com.agprojects.sylk-ios.dev';
}

const mainStyle = StyleSheet.create({

 MainContainer: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   margin: 0
 }
});


function _parseSQLDate(key, value) {
    return new Date(value);
}

(function() {
    if ( typeof Object.id == "undefined" ) {
        var id = 0;

        Object.id = function(o) {
            if ( o && typeof o.__uniqueid == "undefined" ) {
                Object.defineProperty(o, "__uniqueid", {
                    value: ++id,
                    enumerable: false,
                    // This could go either way, depending on your
                    // interpretation of what an "id" is
                    writable: false
                });
            }

            return o ? o.__uniqueid : null;
        };
    }
})();


const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') {
        return;
    }

    try {
        const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
            {
            title: "Sylk camera permission",
            message:
              "Sylk needs access to your camera " +
              "so you can have video chat.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
            }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            //console.log("You can use the camera");
        } else {
            console.log("Camera permission denied");
        }
    } catch (err) {
        console.warn(err);
    }

    try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Sylk microphone permission",
            message:
              "Sylk needs access to your microphone " +
              "so you can have audio calls.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            //console.log("You can use the microphone");
        } else {
            console.log("Microphone permission denied");
        }
    } catch (err) {
        console.warn(err);
    }
};



class Sylk extends Component {
    constructor() {
        super();
        autoBind(this)
        this._loaded = false;
        this._initialState = {
            appState: null,
            autoLogin: true,
            inFocus: false,
            accountId: '',
            password: '',
            displayName: '',
            organization: '',
            account: null,
            registrationState: null,
            registrationKeepalive: false,
            incomingCall: null,
            currentCall: null,
            connection: null,
            showIncomingModal: false,
            showScreenSharingModal: false,
            status: null,
            targetUri: '',
            missedTargetUri: '',
            loading: null,
            syncCoversations: false,
            localMedia: null,
            generatedVideoTrack: false,
            contacts: [],
            devices: {},
            speakerPhoneEnabled: null,
            orientation : 'portrait',
            Height_Layout : '',
            Width_Layout : '',
            outgoingCallUUID: null,
            incomingCallUUID: null,
            hardware: '',
            phoneNumber: '',
            isTablet: isTablet(),
            refreshHistory: false,
            refreshFavorites: false,
            myPhoneNumber: null,
            localHistory: [],
            favoriteUris: [],
            blockedUris: [],
            initialUrl: null,
            reconnectingCall: false,
            muted: false,
            participantsToInvite: [],
            myInvitedParties: {},
            myContacts: {},
            defaultDomain: config.defaultDomain,
            declineReason: null,
            showLogsModal: false,
            logs: '',
            proximityEnabled: true,
            messages: {},
            selectedContact: null,
            callsState: {},
            keys: null,
            showImportPrivateKeyModal: false,
            privateKey: null,
            privateKeyImportStatus: '',
            privateKeyImportSuccess: false,
            inviteContacts: false,
            selectedContacts: [],
            pinned: false,
            callContact: null,
            messageLimit: 100,
            messageZoomFactor: 1,
            messageStart: 0
        };

        utils.timestampedLog('Init app');

        this.syncTimer = null;
        this.lastSyncedMessageId = null;
        this.outgoingMedia = null;
        this.participantsToInvite = [];
        this.tokenSent = false;
        this.mustLogout = false;
        this.currentRoute = null;
        this.pushtoken = null;
        this.pushkittoken = null;
        this.intercomDtmfTone = null;
        this.registrationFailureTimer = null;
        this.contacts = [];
        this.startedByPush = false;
        this.heartbeats = 0;
        this.sql_contacts_keys = [];

        this._onFinishedPlayingSubscription = null
        this._onFinishedLoadingSubscription = null
        this._onFinishedLoadingFileSubscription = null
        this._onFinishedLoadingURLSubscription = null

        this.sync_pending_items = [];

        this.cachedHistory = []; // used for caching server history

        this.state = Object.assign({}, this._initialState);

        this.myParticipants = {};
        this.mySyncJournal = {};

        this._historyConferenceParticipants = new Map(); // for saving to local history

        this._terminatedCalls = new Map();

        this.__notificationCenter = null;

        this.redirectTo = null;
        this.prevPath = null;
        this.shouldUseHashRouting = false;
        this.goToReadyTimer = null;
        this.msg_sound_played_ts = null;

        storage.initialize();
        this.callKeeper = new CallManager(RNCallKeep,
                                                this.acceptCall,
                                                this.rejectCall,
                                                this.hangupCall,
                                                this.timeoutCall,
                                                this.callKeepStartConference,
                                                this.startCallFromCallKeeper,
                                                this.toggleMute,
                                                this.getConnection,
                                                this.addConferenceHistoryEntry,
                                                this.changeRoute,
                                                this.respawnConnection,
                                                this.isUnmounted
                                                );

        if (InCallManager.recordPermission !== 'granted') {
            InCallManager.requestRecordPermission()
            .then((requestedRecordPermissionResult) => {
                //console.log("InCallManager.requestRecordPermission() requestedRecordPermissionResult: ", requestedRecordPermissionResult);
            })
            .catch((err) => {
                //console.log("InCallManager.requestRecordPermission() catch: ", err);
            });
        }

        requestCameraPermission();

        // Load camera/mic preferences
        storage.get('devices').then((devices) => {
            if (devices) {
                this.setState({devices: devices});
            }
        });

        storage.get('history').then((history) => {
            if (history) {
                //console.log('Loaded', history.length, 'local history entries');
                this.setState({localHistory: history});
            } else {
                //console.log('Loaded 0 local history entries');
            }
        });

        storage.get('keys').then((keys) => {
            if (keys) {
                const public_key = keys.public.replace(/\r/g,'');
                const private_key = keys.private.replace(/\r/g, '').trim();

                keys.public = public_key;
                keys.private = private_key;
                this.setState({keys: keys});
                console.log("Loaded PGP public key");
            }

        }).catch((err) => {
            console.log("PGP keys loading error:", err);
        });

        storage.get('cachedHistory').then((history) => {
            if (history) {
                //console.log('Loaded', history.length, 'cached history entries');
                this.cachedHistory = history;
            }
        });

        storage.get('myParticipants').then((myParticipants) => {
            if (myParticipants) {
                this.myParticipants = myParticipants;
                //console.log('My participants', this.myParticipants);
            }
        });

        storage.get('mySyncJournal').then((mySyncJournal) => {
            if (mySyncJournal) {
                this.mySyncJournal = mySyncJournal;
            }
        });

        storage.get('lastSyncedMessageId').then((lastSyncedMessageId) => {
            if (lastSyncedMessageId) {
                this.lastSyncedMessageId = lastSyncedMessageId;
            }
        });

        storage.get('proximityEnabled').then((proximityEnabled) => {
            this.setState({proximityEnabled: proximityEnabled});
        });

        if (this.state.proximityEnabled) {
            utils.timestampedLog('Proximity sensor enabled');
        } else {
            utils.timestampedLog('Proximity sensor disabled');
        }

        this.loadPeople();

        for (let scheme of URL_SCHEMES) {
            DeepLinking.addScheme(scheme);
        }

        this.sqlTableVersions = {'messages': 2,
                                 'contacts': 2,
                                 'keys': 1}

        this.updateTableQueries = {'messages': {1: [], 2: ['delete from messages']},
                                   'contacts': {2: ['alter table contacts add column participants TEXT']},
                                   'keys': {1: []}
                                   };

        this.db = null;
        this.initSQL();

   }

    async saveKeySql(keys) {
        this.setState({keys: {private: keys.private,
                              public: keys.public}});

        if (this.state.account) {
            this.state.account.syncConversations();
        }

        let current_datetime = new Date();
        const unixTime = Math.floor(current_datetime / 1000);
        let params = [this.state.accountId, keys.private, keys.public, unixTime];
        await this.ExecuteQuery("INSERT INTO keys (account, private_key, public_key, timestamp) VALUES (?, ?, ?, ?)", params).then((result) => {
            console.log('SQL inserted private key');
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') > -1) {
                this.updateKeySql(keys);
            } else {
                console.log('Save keys SQL error:', error);
            }
        });

    }

    async updateKeySql(keys) {
        let current_datetime = new Date();
        const unixTime = Math.floor(current_datetime / 1000);
        let params = [keys.private, keys.public, unixTime, this.state.accountId];

        await this.ExecuteQuery("update keys set private_key = ?, public_key = ?, timestamp = ? where account = ?", params).then((result) => {
            console.log('SQL updated private key');
        }).catch((error) => {
            console.log('SQL error:', error);
        });
    }

    loadKeysFromSQL() {
        let keys = {};
        this.ExecuteQuery("SELECT * FROM keys where account = ?",[this.state.accountId]).then((results) => {
            let rows = results.rows;
            if (rows.length === 1) {
                var item = rows.item(0);
                keys.public = item.public_key;
                keys.private = item.private_key;
                console.log('Loaded private key from SQL database');
                this.setState({keys: keys});
            } else {
                if (this.state.keys && this.state.keys.private) {
                    this.saveKeySql(this.state.keys);
                    console.log('Migrated private keys to SQL storage');
                    //storage.remove('keys');
                } else {
                    if (!this.lastSyncedMessageId || !this.state.keys) {
                        this.setState({showImportPrivateKeyModal: !this.state.showImportPrivateKeyModal})
                    }
                    //this.generateKeys();
                }
            }
        });
    }

    async generateKeys(force=false) {
        if (this.state.keys && this.state.keys.public.indexOf('-----BEGIN PGP PUBLIC KEY BLOCK-----') > -1 && !force) {
            return;
        }

        const Options = {
          comment: 'Sylk key',
          email: this.state.accountId,
          name: this.state.displayName || this.state.accountId,
          keyOptions: KeyOptions
        }

        console.log('Generating key pair with options', Options);

        await OpenPGP.generate(Options).then((keys) => {
            const public_key = keys.publicKey.replace(/\r/g, '').trim();
            const private_key = keys.privateKey.replace(/\r/g, '').trim();
            keys.public = public_key;
            keys.private = private_key;
            console.log("PGP keypair generated");
            this.saveKeySql(keys);

        }).catch((error) => {
            console.log("PGP keys generation error:", error);
        });
    }

    loadSylkContacts() {
        let myContacts = {};
        let blockedUris = [];
        let favoriteUris = [];
        let myInvitedParties = {};

        this.ExecuteQuery("SELECT * FROM contacts",[]).then((results) => {
            let rows = results.rows;
            if (rows.length > 0) {
                for (let i = 0; i < rows.length; i++) {
                    var item = rows.item(i);
                    this.sql_contacts_keys.push(item.uri);
                    myContacts[item.uri] = this.newContact(item.uri);
                    myContacts[item.uri].name = item.name;
                    myContacts[item.uri].organization = item.organization;
                    myContacts[item.uri].favorite = item.favorite === 1 ? true: false;
                    myContacts[item.uri].blocked = item.blocked === 1 ? true: false;
                    myContacts[item.uri].publicKey = item.public_key;
                    myContacts[item.uri].tags = item.tags ? item.tags.split(',') : [];
                    myContacts[item.uri].participants = item.participants ? item.participants.split(',') : [];
                    myContacts[item.uri].unread = item.unread ? item.unread.split(',') : [];
                    myContacts[item.uri].lastMessageId = item.last_message_id === '' ? null : item.last_message_id;
                    myContacts[item.uri].lastMessage = item.last_message === '' ? null : item.last_message;
                    myContacts[item.uri].timestamp = new Date(item.timestamp * 1000);

                    //console.log('Loaded contact', myContacts[item.uri]);
                    if(item.participants) {
                        myInvitedParties[item.uri.split('@')[0]] = myContacts[item.uri].participants;
                    }

                    if (item.blocked) {
                        blockedUris.push(item.uri);
                    }
                    if (item.favorite) {
                        favoriteUris.push(item.uri);
                    }
                }

                console.log('Loaded', rows.length, 'contacts from SQL database');
                this.setState({myContacts: myContacts,
                               favoriteUris: favoriteUris,
                               myInvitedParties: myInvitedParties,
                                blockedUris: blockedUris});

            } else {
                if (Object.keys(this.state.myContacts).length > 0) {
                    Object.keys(this.state.myContacts).forEach((key) => {
                        this.saveSylkContact(key, this.state.myContacts[key]);
                    });
                    console.log('Migrated contacts to SQL storage');
                    storage.set('contactStorage', 'sql');
                    storage.remove('myContacts');
                }
            }
        });

        this.loadKeysFromSQL();
    }


    loadPeople() {
        let blockedUris = [];
        let myContacts = {};
        let favoriteUris = [];
        let displayName = null;

        storage.get('displayName').then((displayName) => {
            //console.log('My display name is', displayName);
            this.setState({displayName: displayName});
        }).catch((error) => {
            console.log('get displayName error:', error);
        });

        storage.get('organization').then((organization) => {
            //console.log('My organization is', organization);
            this.setState({organization: organization});
        }).catch((error) => {
            console.log('get organization error:', error);
        });

        storage.get('contactStorage').then((contactStorage) => {
            if (contactStorage !== 'sql') {
                storage.get('myContacts').then((myContacts) => {
                    let myContactsObjects = {};
                    if (myContacts) {
                        Object.keys(myContacts).forEach((key) => {

                            if (!Array.isArray(myContacts[key]['unread'])) {
                                myContacts[key]['unread'] = [];
                            }

                            if(typeof(myContacts[key]) == 'string') {
                                console.log('Convert display name object');
                                myContactsObjects[key] = {'name': myContacts[key]}
                            } else {
                                myContactsObjects[key] = myContacts[key];
                            }

                        });
                        myContacts = myContactsObjects;
                    } else {
                        myContacts = {};
                    }

                    console.log('Loaded', Object.keys(myContacts).length, 'contacts');

                    this.setState({myContacts: myContacts});

                    storage.get('favoriteUris').then((favoriteUris) => {
                        favoriteUris = favoriteUris.filter(item => item !== null);
                        //console.log('My favorites:', favoriteUris);
                        this.setState({favoriteUris: favoriteUris});

                        favoriteUris.forEach((uri) => {
                            if (uri in myContacts) {
                                myContacts[uri].favorite = true;
                            } else {
                                myContacts[uri] = {name: '', favorite: true};
                            }
                        });

                        storage.remove('favoriteUris');

                    }).catch((error) => {
                        //console.log('get favoriteUris error:', error);
                        let uris = Object.keys(myContacts);
                        uris.forEach((uri) => {
                            if (myContacts[uri].favorite) {
                                favoriteUris.push(uri);
                            }
                        });

                        console.log('Loaded', favoriteUris.length, 'favorites');
                        this.setState({favoriteUris: favoriteUris});
                    });

                    storage.get('blockedUris').then((blockedUris) => {
                        blockedUris = blockedUris.filter(item => item !== null);
                        console.log('My blockedUris:', blockedUris);
                        this.setState({blockedUris: blockedUris});

                        blockedUris.forEach((uri) => {
                            if (uri in myContacts) {
                                myContacts[uri].blocked = true;
                            } else {
                                myContacts[uri] = {name: '', blocked: true};
                            }
                        });

                        storage.remove('blockedUris');

                    }).catch((error) => {
                        //console.log('get favoriteUris error:', error);
                        let uris = Object.keys(myContacts);
                        uris.forEach((uri) => {
                            if (myContacts[uri].blocked) {
                                blockedUris.push(uri);
                            }
                        });

                        console.log('Loaded', blockedUris.length, 'blocked uris');
                        this.setState({blockedUris: blockedUris});
                    });

                }).catch((error) => {
                    console.log('get myContacts error:', error);
                });

            }
        });

    }

    async initSQL() {
        const database_name = "sylk.db";
        const database_version = "1.0";
        const database_displayname = "Sylk Database";
        const database_size = 200000;

        await SQLite.openDatabase(database_name, database_version, database_displayname, database_size).then((DB) => {
            this.db = DB;
            console.log('SQL database', database_name, 'opened');
            //this.dropTables();
            this.createTables();
        }).catch((error) => {
            console.log('SQL database error:', error);
        });
    }

    dropTables() {
        console.log('Drop SQL tables...')
        this.ExecuteQuery("DROP TABLE if exists 'chat_uris';");
        this.ExecuteQuery("DROP TABLE if exists 'recipients';");
        this.ExecuteQuery("DROP TABLE 'messages';");
        this.ExecuteQuery("DROP TABLE 'versions';");
    }

    createTables() {
        //console.log('Create SQL tables...')
        let create_versions_table = "CREATE TABLE IF NOT EXISTS 'versions' ( \
                                    'id' INTEGER PRIMARY KEY AUTOINCREMENT, \
                                    'table' TEXT UNIQUE, \
                                    'version' INTEGER NOT NULL );\
                                    ";

        this.ExecuteQuery(create_versions_table).then((success) => {
            //console.log('SQL version table created');
        }).catch((error) => {
            console.log(create_versions_table);
            console.log('SQL version table creation error:', error);
        });


        let create_table_messages = "CREATE TABLE IF NOT EXISTS 'messages' ( \
                                    'id' INTEGER PRIMARY KEY AUTOINCREMENT, \
                                    'msg_id' TEXT UNIQUE, \
                                    'timestamp' TEXT, \
                                    'content' BLOB, \
                                    'content_type' TEXT, \
                                    'from_uri' TEXT, \
                                    'to_uri' TEXT, \
                                    'sent' INTEGER, \
                                    'sent_timestamp' TEXT, \
                                    'encrypted' INTEGER, \
                                    'received' INTEGER, \
                                    'received_timestamp' TEXT, \
                                    'expire_interval' INTEGER, \
                                    'deleted' INTEGER, \
                                    'pinned' INTEGER, \
                                    'pending' INTEGER, \
                                    'system' INTEGER, \
                                    'url' TEXT, \
                                    'direction' TEXT) \
                                    ";

        this.ExecuteQuery(create_table_messages).then((success) => {
            //console.log('SQL messages table OK');
        }).catch((error) => {
            console.log(create_table_messages);
            console.log('SQL messages table creation error:', error);
        });

        let create_table_contacts = "CREATE TABLE IF NOT EXISTS 'contacts' ( \
                                    'uri' TEXT PRIMARY KEY, \
                                    'account' TEXT, \
                                    'name' TEXT, \
                                    'organization' TEXT, \
                                    'tags' TEXT, \
                                    'participants' TEXT, \
                                    'public_key' TEXT, \
                                    'timestamp' INTEGER, \
                                    'blocked' INTEGER default 0, \
                                    'favorite' INTEGER default 0, \
                                    'last_message' TEXT, \
                                    'last_message_id' TEXT, \
                                    'unread_messages' TEXT ) \
                                    ";

        this.ExecuteQuery(create_table_contacts).then((success) => {
            //console.log('SQL contacts table OK');
        }).catch((error) => {
            console.log(create_table_contacts);
            console.log('SQL messages table creation error:', error);
        });

        let create_table_keys = "CREATE TABLE IF NOT EXISTS 'keys' ( \
                                    'account' TEXT PRIMARY KEY, \
                                    'private_key' TEXT, \
                                    'checksum' TEXT, \
                                    'public_key' TEXT, \
                                    'timestamp' INTEGER ) \
                                    ";

        this.ExecuteQuery(create_table_keys).then((success) => {
            //console.log('SQL keys table OK');
        }).catch((error) => {
            console.log(create_table_keys);
            console.log('SQL keys table creation error:', error);
        });

        this.upgradeSQLTables();
    }

    upgradeSQLTables() {
        //console.log('Upgrade SQL tables')
        let query;
        let update_queries;
        let update_sub_queries;
        let version_numbers;

        /*
        this.ExecuteQuery("ALTER TABLE 'messages' add column received_timestamp TEXT after received");
        this.ExecuteQuery("ALTER TABLE 'messages' add column sent_timestamp TEXT after sent");
        */

        query = "SELECT * FROM versions";
        let currentVersions = {};

        this.ExecuteQuery(query,[]).then((results) => {
            let rows = results.rows;
            for (let i = 0; i < rows.length; i++) {
                var item = rows.item(i);
                currentVersions[item.table] = item.version;
            }

            for (const [key, value] of Object.entries(this.sqlTableVersions)) {
                if (currentVersions[key] == null) {
                    query = "INSERT INTO versions ('table', 'version') values ('" + key + "', '" + this.sqlTableVersions[key] + "')";
                    //console.log(query);
                    this.ExecuteQuery(query);
                } else {
                    if (this.sqlTableVersions[key] > currentVersions[key]) {
                        console.log('Table', key, 'must have version', value, 'and it has', currentVersions[key]);
                        update_queries = this.updateTableQueries[key];
                        version_numbers = Object.keys(update_queries);
                        version_numbers.sort(function(a, b){return a-b});
                        version_numbers.forEach((version) => {
                            if (version <= currentVersions[key]) {
                                return;
                            }
                            update_sub_queries = update_queries[version];
                            update_sub_queries.forEach((query) => {
                                console.log('Run query for table', key, 'version', version, ':', query);
                                this.ExecuteQuery(query);
                            });

                        });

                        query = "update versions set version = " + this.sqlTableVersions[key] + " where \"table\" = '" + key + "';";
                        //console.log(query);
                        this.ExecuteQuery(query);

                    } else {
                        //console.log('No upgrade required for table', key);
                    }
                }
            }

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });

    }

    /*
    * Execute sql queries
    *
    * @param sql
    * @param params
    *
    * @returns {resolve} results
    */

    ExecuteQuery = (sql, params = []) => new Promise((resolve, reject) => {
        //console.log('-- Execute SQL query:', sql, params);
        this.db.transaction((trans) => {
          trans.executeSql(sql, params, (trans, results) => {
            resolve(results);
          },
            (error) => {
              reject(error);
            });
        });
      });

    async loadDeviceContacts() {
        Contacts.checkPermission((err, permission) => {
            if (permission === Contacts.PERMISSION_UNDEFINED) {
              Contacts.requestPermission((err, requestedContactsPermissionResult) => {
                if (err) {
                    console.log("Contacts.requestPermission()catch: ", err);
                }
                console.log("Contacts.requestPermission() requestPermission: ", requestedContactsPermissionResult);
              })
            }
          })

          Contacts.getAll((err, contacts) => {
            if (err === 'denied'){
                console.log('Access to contacts denied')
            } else {
                // contacts returned in Array
                let contact_cards = [];
                let name;
                let photo;

                let seen_uris = new Map();

                var arrayLength = contacts.length;
                for (var i = 0; i < arrayLength; i++) {
                    photo = null;
                    contact = contacts[i];
                    if (contact['givenName'] && contact['familyName']) {
                        name = contact['givenName'] + ' ' + contact['familyName'];
                    } else if (contact['givenName']) {
                        name = contact['givenName'];
                    } else if (contact['familyName']) {
                        name = contact['familyName'];
                    } else if (contact['company']) {
                        name = contact['company'];
                    } else {
                        continue;
                    }

                    if (contact.hasThumbnail) {
                        photo = contact.thumbnailPath;
                    } else {
                        photo = null;
                    }

                    //console.log(name);
                    contact['phoneNumbers'].forEach(function (number, index) {
                        let number_stripped =  number['number'].replace(/\s|\-|\(|\)/g, '');
                        if (number_stripped) {
                            if (!seen_uris.has(number_stripped)) {
                                //console.log('   ---->    ', number['label'], number_stripped);
                                var contact_card = {id: uuid.v4(), displayName:
                                                    name, remoteParty: number_stripped,
                                                    type: 'contact',
                                                    photo: photo,
                                                    label: number['label'],
                                                    tags: ['contact']};
                                contact_cards.push(contact_card);
                                seen_uris.set(number_stripped, true);
                                var contact_card = {id: uuid.v4(),
                                                    displayName: name,
                                                    remoteParty: number_stripped,
                                                    type: 'contact',
                                                    photo: photo,
                                                    label: number['label'],
                                                    tags: ['contact']
                                                    };
                            }
                        }
                    });

                    contact['emailAddresses'].forEach(function (email, index) {
                        let email_stripped =  email['email'].replace(/\s|\(|\)/g, '');
                        if (!seen_uris.has(email_stripped)) {
                            //console.log(name, email['label'], email_stripped);
                            //console.log('   ---->    ', email['label'], email_stripped);
                            var contact_card = {id: uuid.v4(),
                                                displayName: name,
                                                remoteParty: email_stripped,
                                                type: 'contact',
                                                photo: photo,
                                                label: email['label'],
                                                tags: ['contact']
                                                };
                            contact_cards.push(contact_card);
                            seen_uris.set(email_stripped, true);
                        }
                    });
                }

              this.contacts = contact_cards;
            }
          })
    }

    get _notificationCenter() {
        // getter to lazy-load the NotificationCenter ref
        if (!this.__notificationCenter) {
            this.__notificationCenter = this.refs.notificationCenter;
        }
        return this.__notificationCenter;
    }

    findObjectByKey(array, key, value) {
        for (var i = 0; i < array.length; i++) {
            if (array[i][key] === value) {
                return array[i];
            }
        }
        return null;
    }

    _detectOrientation() {
        if(this.state.Width_Layout > this.state.Height_Layout && this.state.orientation !== 'landscape') {
            this.setState({orientation: 'landscape'});
        } else {
            this.setState({orientation: 'portrait'});
        }
     }

    changeRoute(route, reason) {
        utils.timestampedLog('Change route', route, 'with reason:', reason);
        if (this.currentRoute === route) {
            if (route === '/ready' && this.state.selectedContact) {
                this.setState({
                                selectedContact: null,
                                targetUri: '',
                                messageZoomFactor: 1
                                });
            }
            return;
        }


        if (this.currentRoute !== route) {
            utils.timestampedLog('Change route:', this.currentRoute, '->', route, reason);
        }

        if (route === '/conference') {
           this.backToForeground();
           this.setState({inviteContacts: false});
        }

        if (route === '/call') {
           this.backToForeground();
        }

        if (route === '/ready' && reason !== 'back to home') {
            Vibration.cancel();

            if (reason === 'conference_really_ended' && this.callKeeper.countCalls) {
                utils.timestampedLog('Change route cancelled because we still have calls');
                return;
            }

            this.startedByPush = false;
            this.setState({
                            outgoingCallUUID: null,
                            currentCall: null,
                            callContact: null,
                            inviteContacts: false,
                            selectedContacts: [],
                            incomingCall: (reason === 'accept_new_call' || reason === 'user_hangup_call') ? this.state.incomingCall: null,
                            reconnectingCall: false,
                            muted: false
                            });

            if (this.currentRoute === '/call' || this.currentRoute === '/conference') {
                if (reason !== 'user_hangup_call') {
                    this.stopRingback();
                    InCallManager.stop();
                }

                this.closeLocalMedia();

                if (reason === 'accept_new_call') {
                    if (this.state.incomingCall) {
                        // then answer the new call if any
                        let hasVideo = (this.state.incomingCall && this.state.incomingCall.mediaTypes && this.state.incomingCall.mediaTypes.video) ? true : false;
                        this.getLocalMedia(Object.assign({audio: true, video: hasVideo}), '/call');
                    }
                } else if (reason === 'escalate_to_conference') {
                    const uri = `${utils.generateSillyName()}@${config.defaultConferenceDomain}`;
                    const options = {audio: this.outgoingMedia ? this.outgoingMedia.audio: true,
                                     video: this.outgoingMedia ? this.outgoingMedia.video: true,
                                     participants: this.participantsToInvite}

                    this.callKeepStartConference(uri.toLowerCase(), options);
                } else {
                    if (this.state.account && this._loaded) {
                        setTimeout(() => {
                            this.updateServerHistory()
                        }, 1500);
                    }
                }
            }

            if (reason === 'registered') {
                setTimeout(() => {
                    this.updateServerHistory()
                }, 1500);
            }

            if (reason === 'no_more_calls') {
                this.updateServerHistory()
            }
        }

        this.currentRoute = route;
        history.push(route);

    }

    componentWillUnmount() {
        utils.timestampedLog('App will unmount');
        AppState.removeEventListener('change', this._handleAppStateChange);

        this._onFinishedPlayingSubscription.remove();
        this._onFinishedLoadingSubscription.remove();
        this._onFinishedLoadingURLSubscription.remove();
        this._onFinishedLoadingFileSubscription.remove();

        this.callKeeper.destroy();
        this.closeConnection();
        this._loaded = false;
    }

    get unmounted() {
        return !this._loaded;
    }

    isUnmounted() {
        return this.unmounted;
    }

    backPressed() {
        console.log('Back button pressed in route', this.currentRoute);

        if (this.currentRoute === '/ready' && this.state.selectedContact) {
            this.goBackToHome();
        }

        if (this.currentRoute === '/call' || this.currentRoute === '/conference') {
            let call = this.state.currentCall || this.state.incomingCall;
            if (call && call.id) {
                this.hangupCall(call.id, 'user_hangup_call');
            }
        }

        return true;
    }

    async componentDidMount() {
        utils.timestampedLog('App did mount');
        this._loaded = true;

        BackHandler.addEventListener('hardwareBackPress', this.backPressed);
        // Start a timer that runs once after X milliseconds
        BackgroundTimer.runBackgroundTimer(() => {
            // this will be executed once after 10 seconds
            // even when app is the the background
            this.heartbeat();
        }, 5000);

        try {
            await RNCallKeep.supportConnectionService ();
            //utils.timestampedLog('Connection service is enabled');
        } catch(err) {
            utils.timestampedLog(err);
        }

        try {
            await RNCallKeep.hasPhoneAccount();
            //utils.timestampedLog('Phone account is enabled');
        } catch(err) {
            utils.timestampedLog(err);
        }

        if (Platform.OS === 'android') {
            RNDrawOverlay.askForDispalayOverOtherAppsPermission()
                 .then(res => {
                   //utils.timestampedLog("Display over other apps was granted");
                     // res will be true if permission was granted
                 })
                 .catch(e => {
                   utils.timestampedLog("Display over other apps was declined");
                     // permission was declined
                 })
        }

        // prime the ref
        //logger.debug('NotificationCenter ref: %o', this._notificationCenter);

        this._boundOnPushkitRegistered = this._onPushkitRegistered.bind(this);
        this._boundOnPushRegistered = this._onPushRegistered.bind(this);

        this._detectOrientation();

        getPhoneNumber().then(phoneNumber => {
            this.setState({myPhoneNumber: phoneNumber});
            this.loadDeviceContacts();
        });

        this.listenforPushNotifications();
        this.listenforSoundNotifications();
    }

    listenforSoundNotifications() {
     // Subscribe to event(s) you want when component mounted
        this._onFinishedPlayingSubscription = SoundPlayer.addEventListener('FinishedPlaying', ({ success }) => {
          //console.log('finished playing', success)
        })
        this._onFinishedLoadingSubscription = SoundPlayer.addEventListener('FinishedLoading', ({ success }) => {
          //console.log('finished loading', success)
        })
        this._onFinishedLoadingFileSubscription = SoundPlayer.addEventListener('FinishedLoadingFile', ({ success, name, type }) => {
          //console.log('finished loading file', success, name, type)
        })
        this._onFinishedLoadingURLSubscription = SoundPlayer.addEventListener('FinishedLoadingURL', ({ success, url }) => {
          //console.log('finished loading url', success, url)
        })
    }

    listenforPushNotifications() {
        if (this.state.appState === null) {
            this.setState({appState: 'active'});
        } else {
            return;
        }

        if (Platform.OS === 'android') {
            Linking.getInitialURL().then((url) => {
                if (url) {
                     utils.timestampedLog('Initial external URL: ' + url);
                     this.eventFromUrl(url);
                      this.changeRoute('/login', 'start up');
                } else {
                      this.changeRoute('/login', 'start up');
                }
            }).catch(err => {
                logger.error({ err }, 'Error getting external URL');
            });

            firebase.messaging().getToken()
            .then(fcmToken => {
                if (fcmToken) {
                    this._onPushRegistered(fcmToken);
                }
            });

            Linking.addEventListener('url', this.updateLinkingURL);

        } else if (Platform.OS === 'ios') {
            this.changeRoute('/login', 'start up');

            VoipPushNotification.addEventListener('register', this._boundOnPushkitRegistered);
            VoipPushNotification.registerVoipToken();

            PushNotificationIOS.addEventListener('register', this._boundOnPushRegistered);

            //let permissions = await checkIosPermissions();
            //if (!permissions.alert) {
                PushNotificationIOS.requestPermissions();
            //}
        }

        this.boundProximityDetect = this._proximityDetect.bind(this);

        DeviceEventEmitter.addListener('Proximity', this.boundProximityDetect);

        AppState.addEventListener('change', this._handleAppStateChange);

        if (Platform.OS === 'ios') {
            this._boundOnNotificationReceivedBackground = this._onNotificationReceivedBackground.bind(this);
            this._boundOnLocalNotificationReceivedBackground = this._onLocalNotificationReceivedBackground.bind(this);
            VoipPushNotification.addEventListener('notification', this._boundOnNotificationReceivedBackground);
            VoipPushNotification.addEventListener('localNotification', this._boundOnLocalNotificationReceivedBackground);
        } else if (Platform.OS === 'android') {
            AppState.addEventListener('focus', this._handleAndroidFocus);
            AppState.addEventListener('blur', this._handleAndroidBlur);

            firebase
                .messaging()
                .requestPermission()
                .then(() => {
                    // User has authorised
                })
                .catch(error => {
                    // User has rejected permissions
                });

            this.messageListener = firebase
                .messaging()
                .onMessage((message: RemoteMessage) => {
                    // this will just wake up the app to receive
                    // the web-socket invite handled by this.incomingCall()
                    let event = message.data.event;
                    const callUUID = message.data['session-id'];
                    const from = message.data['from_uri'];
                    const to = message.data['to_uri'];
                    const displayName = message.data['from_display_name'];
                    const outgoingMedia = {audio: true, video: message.data['media-type'] === 'video'};
                    const mediaType = message.data['media-type'] || 'audio';

                    if (this.unmounted) {
                        return;
                    }

                    if (event === 'incoming_conference_request') {
                        utils.timestampedLog('Push notification: incoming conference', callUUID);
                        this.incomingConference(callUUID, to, from, displayName, outgoingMedia);
                    } else if (event === 'incoming_session') {
                        utils.timestampedLog('Push notification: incoming call', callUUID);
                        this.incomingCallFromPush(callUUID, from, displayName, mediaType);
                    } else if (event === 'cancel') {
                        this.cancelIncomingCall(callUUID);
                    }
                });
        }
    }

    cancelIncomingCall(callUUID) {
        if (this.unmounted) {
            return;
        }

        if (this.callKeeper._acceptedCalls.has(callUUID)) {
            return;
        }

        utils.timestampedLog('Push notification: cancel call', callUUID);

        let call = this.callKeeper._calls.get(callUUID);
        if (!call) {
            if (!this.callKeeper._cancelledCalls.has(callUUID)) {
                utils.timestampedLog('Cancel incoming call that did not arrive on web socket', callUUID);
                this.callKeeper.endCall(callUUID, CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
                this.startedByPush = false;
                if (this.startedByPush) {
                    this.changeRoute('/ready', 'incoming_call_cancelled');
                }
            }
            return;
        }

        if (call.state === 'incoming') {
            utils.timestampedLog('Cancel incoming call that was not yet accepted', callUUID);
            this.callKeeper.endCall(callUUID, CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
            if (this.startedByPush) {
                this.changeRoute('/ready', 'incoming_call_cancelled');
            }
        }
    }

    _proximityDetect(data) {
        //utils.timestampedLog('Proximity changed, isNear is', data.isNear);
        if (!this.state.proximityEnabled) {
            return;
        }

        if (data.isNear) {
           this.speakerphoneOff();
        } else {
           this.speakerphoneOn();
        }
    }

    startCallWhenReady(targetUri, options) {
        this.resetGoToReadyTimer();

        if (options.conference) {
            this.startConference(targetUri, options);
        } else {
            this.startCall(targetUri, options);
        }
    }
    _sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    _onPushkitRegistered(token) {
        this.pushkittoken = token;
    }

    _onPushRegistered(token) {
        this.pushtoken = token;
    }

    _sendPushToken(account) {
        if ((this.pushtoken && !this.tokenSent)) {
            let token = null;

            if (Platform.OS === 'ios') {
                token = `${this.pushkittoken}-${this.pushtoken}`;
            } else if (Platform.OS === 'android') {
                token = this.pushtoken;
            }
            utils.timestampedLog('Push token sent to server');
            account.setDeviceToken(token, Platform.OS, deviceId, true, bundleId);
            this.tokenSent = true;
        }
    }

    _handleAndroidFocus = nextFocus => {
        //utils.timestampedLog('----- APP in focus');
        this.setState({inFocus: true});
        this.respawnConnection();
    }

    _handleAndroidBlur = nextBlur => {
        //utils.timestampedLog('----- APP out of focus');
        this.setState({inFocus: false});
    }

    _handleAppStateChange = nextAppState => {
        //utils.timestampedLog('----- APP state changed', this.state.appState, '->', nextAppState);

        if (nextAppState === this.state.appState) {
            return;
        }

        if (this.callKeeper.countCalls === 0 && !this.state.outgoingCallUUID) {
            /*

            utils.timestampedLog('----- APP state changed', this.state.appState, '->', nextAppState);

            if (this.callKeeper.countCalls) {
                utils.timestampedLog('- APP state changed, we have', this.callKeeper.countCalls, 'calls');
            }

            if (this.callKeeper.countPushCalls) {
                utils.timestampedLog('- APP state changed, we have', this.callKeeper.countPushCalls, 'push calls');
            }

            if (this.startedByPush) {
                utils.timestampedLog('- APP state changed, started by push in', nextAppState, 'state');
            }

            if (this.state.connection) {
                utils.timestampedLog('- APP state changed from', this.state.appState, 'to', nextAppState, 'with connection', Object.id(this.state.connection));
            } else {
                utils.timestampedLog('- APP state changed from', this.state.appState, 'to', nextAppState);
            }
            */

        }

        if (this.state.appState === 'background' && nextAppState === 'active') {
            this.respawnConnection(nextAppState);
        }

        this.setState({appState: nextAppState});
    }

    respawnConnection(state) {
        if (!this.state.connection) {
            utils.timestampedLog('Web socket does not exist');
        } else if (!this.state.connection.state) {
            utils.timestampedLog('Web socket is waiting for connection...');
        } else {
            /*
            if (this.state.connection.state !== 'ready' && this.state.connection.state !== 'connecting') {
                utils.timestampedLog('Web socket', Object.id(this.state.connection), 'reconnecting because', this.state.connection.state);
                this.state.connection.reconnect();
                utils.timestampedLog('Web socket', Object.id(this.state.connection), 'new state is', this.state.connection.state);
            }
            */
        }

        if (this.state.account) {
            if (!this.state.connection) {
                utils.timestampedLog('Active account without connection removed');
                this.setState({account: null});
            }
        } else {
            utils.timestampedLog('No active account');
        }

        if (this.state.accountId && (!this.state.connection || !this.state.account)) {
            this.handleRegistration(this.state.accountId, this.state.password);
        }
    }

    closeConnection(reason='unmount') {
        if (!this.state.connection) {
            return;
        }

        if (!this.state.account && this.state.connection) {
            this.state.connection.removeListener('stateChanged', this.connectionStateChanged);
            this.state.connection.close();
            utils.timestampedLog('Web socket', Object.id(this.state.connection), 'will close');
            this.setState({connection: null, account: null});
        } else if (this.state.connection && this.state.account) {
            this.state.connection.removeListener('stateChanged', this.connectionStateChanged);

            this.state.account.removeListener('outgoingCall', this.outgoingCall);
            this.state.account.removeListener('conferenceCall', this.outgoingConference);
            this.state.account.removeListener('incomingCall', this.incomingCallFromWebSocket);
            this.state.account.removeListener('missedCall', this.missedCall);
            this.state.account.removeListener('conferenceInvite', this.conferenceInviteFromWebSocket);

            this.state.connection.removeAccount(this.state.account,
                (error) => {
                    if (error) {
                        utils.timestampedLog('Failed to remove account:', error);
                    } else {
                        //utils.timestampedLog('Account removed');
                    }

                    if (this.state.connection) {
                        utils.timestampedLog('Web socket', Object.id(this.state.connection), 'will close');
                        this.state.connection.close();
                    }

                    this.setState({connection: null, account: null});
                }
            );
        } else {
            this.setState({connection: null, account: null});
        }
    }

    startCallFromCallKeeper(data) {
        utils.timestampedLog('Starting call from OS...');
        let callUUID = data.callUUID || uuid.v4();
        let is_conf = data.handle.search('videoconference.') === -1 ? false: true;

        this.backToForeground();

        if (is_conf) {
            this.callKeepStartConference(data.handle, {audio: true, video: data.video || true, callUUID: callUUID});
        } else {
            this.callKeepStartCall(data.handle, {audio: true, video: data.video, callUUID: callUUID});
        }
        this._notificationCenter.removeNotification();
    }

    selectContact(contact) {
        this.setState({selectedContact: contact});
    }

    connectionStateChanged(oldState, newState) {
        if (this.unmounted) {
            return;
        }

        const connection = this.getConnection();

        if (oldState) {
            utils.timestampedLog('Web socket', connection, 'state changed:', oldState, '->' , newState);
        }

        switch (newState) {
            case 'closed':
                if (this.state.connection) {
                    utils.timestampedLog('Web socket was terminated');
                    this.state.connection.removeListener('stateChanged', this.connectionStateChanged);
                    this._notificationCenter.postSystemNotification('Connection lost');
                }
                //this.setState({connection: null, account: null});
                this.setState({account: null});
                break;
            case 'ready':
                this._notificationCenter.removeNotification();
                this.processRegistration(this.state.accountId, this.state.password);
                this.callKeeper.setAvailable(true);
                break;
            case 'disconnected':
                if (this.registrationFailureTimer) {
                    clearTimeout(this.registrationFailureTimer);
                    this.registrationFailureTimer = null;
                }
                if (this.state.currentCall && this.state.currentCall.direction === 'outgoing') {
                    this.hangupCall(this.state.currentCall.id, 'outgoing_connection_failed');
                }

                if (this.state.incomingCall) {
                    this.hangupCall(this.state.incomingCall.id, 'connection_failed');
                }

                this.setState({
                    registrationState: 'failed',
                    generatedVideoTrack: false,
                    });

                if (this.currentRoute === '/login') {
                    this.changeRoute('/ready', 'websocket disconnected');
                }

                break;
            default:
                if (this.state.registrationKeepalive !== true) {
                    this.setState({loading: 'Connecting...'});
                }
                break;
        }
    }

    notificationCenter() {
        return this._notificationCenter;
    }

    showRegisterFailure(reason) {
        const connection = this.getConnection();

        utils.timestampedLog('Registration error: ' + reason, 'on web socket', connection);
        this.setState({
            loading     : null,
            registrationState: 'failed',
            status      : {
                msg   : 'Sign In failed: ' + reason,
                level : 'danger'
            }
        });

        if (this.startedByPush) {
            // TODO: hangup incoming call
        }

        if (this.currentRoute === '/login') {
            this.changeRoute('/ready', 'register failure');
        }

    }

    registrationStateChanged(oldState, newState, data) {
        if (this.unmounted) {
            return;
        }

        const connection = this.getConnection();

        if (oldState) {
            utils.timestampedLog('Registration state changed:', oldState, '->', newState, 'on web socket', connection);
        }

        if (!this.state.account) {
            utils.timestampedLog('Account disabled');
            return;
        }

        if (newState === 'failed') {
            let reason = data.reason;

            if (reason === 904) {
                // Sofia SIP: WAT
                reason = 'Wrong account or password';
            } else if (reason === 408) {
                reason = 'Timeout';
            }

            this.showRegisterFailure(reason);

            if (this.state.registrationKeepalive === true) {
                if (this.state.connection !== null && this.state.connection.state === 'ready') {
                    utils.timestampedLog('Retry to register...');
                    this.state.account.register();
                }
            } else {
                // add a timer to retry register after awhile
                if (reason >= 500 || reason === 408) {
                    utils.timestampedLog('Retry to register after 5 seconds delay...');
                    setTimeout(this.state.account.register(), 5000);
                } else {
                    if (this.registrationFailureTimer) {
                        utils.timestampedLog('Cancel registration timer');
                        clearTimeout(this.registrationFailureTimer);
                        this.registrationFailureTimer = null;
                    }
                }
            }
            if (this.currentRoute === '/login') {
                this.changeRoute('/ready', 'register failed');
            }

        } else if (newState === 'registered') {
            if (this.registrationFailureTimer) {
                clearTimeout(this.registrationFailureTimer);
                this.registrationFailureTimer = null;
            }


            this.setState({loading: null,
                           registrationKeepalive: true,
                           registrationState: 'registered',
                           defaultDomain: this.state.account ? this.state.account.id.split('@')[1]: null
                           });

            if (this.state.keys && this.state.keys.private) {
                utils.timestampedLog('Request sync messages from server', this.lastSyncedMessageId);
                this.state.account.syncConversations(this.lastSyncedMessageId);
            }

            this.replayJournal();

            //if (this.currentRoute === '/login' && (!this.startedByPush || Platform.OS === 'ios'))  {
            // TODO if the call does not arrive, we never get back to ready
            if (this.currentRoute === '/login') {
                this.changeRoute('/ready', 'registered');
            }
            return;
        } else {
            this.setState({status: null, registrationState: newState });
        }

        if (this.mustLogout) {
            this.logout();
        }
    }

    showInternalAlertPanel() {
        this.setState({showIncomingModal: true});
        //Vibration.vibrate(VIBRATION_PATTERN, true);
        setTimeout(() => {
             Vibration.cancel();
        }, 30000);
    }

    hideInternalAlertPanel() {
        Vibration.cancel();
        this.setState({showIncomingModal: false});
    }

    heartbeat() {
        if (this.unmounted) {
            return;
        }

        this.heartbeats = this.heartbeats + 1;

        if (this.heartbeats % 40 == 0) {
            this.trimLogs();
        }

        if (this.state.connection) {
            //console.log('Check calls in', this.state.appState, 'with connection', Object.id(this.state.connection), this.state.connection.state);
        } else {
            //console.log('Check calls in', this.state.appState, 'with no connection');
        }

        let callState;
        if (this.state.currentCall && this.state.incomingCall && this.state.incomingCall === this.state.currentCall) {
            //utils.timestampedLog('We have an incoming call:', this.state.currentCall ? (this.state.currentCall.id + ' ' + this.state.currentCall.state): 'None');
            callState = this.state.currentCall.state;
        } else if (this.state.incomingCall) {
            //utils.timestampedLog('We have an incoming call:', this.state.incomingCall ? (this.state.incomingCall.id + ' ' + this.state.incomingCall.state): 'None');
            callState = this.state.incomingCall.state;
        } else if (this.state.currentCall) {
            //utils.timestampedLog('We have an outgoing call:', this.state.currentCall ? (this.state.currentCall.id + ' ' + this.state.currentCall.state): 'None');
            callState = this.state.currentCall.state;
        } else if (this.state.outgoingCallUUID) {
            //utils.timestampedLog('We have a pending outgoing call:', this.state.outgoingCallUUID);
        } else {
            //utils.timestampedLog('We have no calls');
            if (this.state.appState === 'background' && this.state.connection && this.state.connection.state === 'ready') {
                //this.closeConnection('background with no calls');
            }
        }

        this.callKeeper.heartbeat();
    }

    stopRingback() {
        //utils.timestampedLog('Stop ringback');
        InCallManager.stopRingback();
    }

    resetGoToReadyTimer() {
        if (this.goToReadyTimer !== null) {
            clearTimeout(this.goToReadyTimer);
            this.goToReadyTimer = null;
        }
    }

    goToReadyNowAndCancelTimer() {
        if (this.goToReadyTimer !== null) {
            clearTimeout(this.goToReadyTimer);
            this.goToReadyTimer = null;
            this.changeRoute('/ready', 'cancel_timer_incoming_call');
        }
    }

    isConference(call) {
        const _call = call || this.state.currentCall;
        if (_call && _call.hasOwnProperty('_participants')) {
            return true;
        }

        return false;
    }

    callStateChanged(oldState, newState, data) {
        if (this.unmounted) {
            return;
        }

        // outgoing accepted: null -> progress -> accepted -> established -> terminated
        // outgoing accepted: null -> progress -> established -> accepted -> terminated (with early media)
        // incoming accepted: null -> incoming -> accepted -> established -> terminated
        // 2nd incoming call is automatically rejected by sylkrtc library

        /*
        utils.timestampedLog('---currentCall start:', this.state.currentCall);
        utils.timestampedLog('---incomingCall start:', this.state.incomingCall);
        */

        let call = this.callKeeper._calls.get(data.id);

        if (!call) {
            utils.timestampedLog("callStateChanged error: call", data.id, 'not found in callkeep manager');
            return;
        }

        let callUUID = call.id;
        const connection = this.getConnection();
        utils.timestampedLog('Sylkrtc call', callUUID, 'state change:', oldState, '->', newState, 'on web socket', connection);

        /*
        if (newState === 'established' || newState === 'accepted') {
            // restore the correct UI state if it has transitioned illegally to /ready state
            if (call.hasOwnProperty('_participants')) {
                this.changeRoute('/conference', 'correct call state');
            } else {
                this.changeRoute('/call', 'correct call state');
            }
        }
        */

        let newCurrentCall;
        let newincomingCall;
        let direction = call.direction;
        let hasVideo = false;
        let mediaType = 'audio';
        let tracks;
        let readyDelay = 5000;

        if (this.state.incomingCall && this.state.currentCall) {
            if (newState === 'terminated') {
                if (this.state.incomingCall == this.state.currentCall) {
                    newCurrentCall = null;
                    newincomingCall = null;
                }

                if (this.state.incomingCall.id === call.id) {
                    if (oldState === 'incoming') {
                        //utils.timestampedLog('Call state changed:', 'incoming call must be cancelled');
                        this.hideInternalAlertPanel();
                    }

                    if (oldState === 'established' || oldState === 'accepted') {
                        //utils.timestampedLog('Call state changed:', 'incoming call ended');
                        this.hideInternalAlertPanel();
                    }
                    // new call must be cancelled
                    newincomingCall = null;
                    newCurrentCall = this.state.currentCall;
                }

                if (this.state.currentCall != this.state.incomingCall && this.state.currentCall.id === call.id) {
                    if (oldState === 'established' || newState === 'accepted') {
                        //utils.timestampedLog('Call state changed:', 'outgoing call must be hangup');
                        // old call must be closed
                    }
                    newCurrentCall = null;
                    newincomingCall = this.state.incomingCall;
                }

            } else if (newState === 'accepted') {
                if (this.state.incomingCall === this.state.currentCall) {
                    newCurrentCall = this.state.incomingCall;
                    newincomingCall = this.state.incomingCall;
                } else {
                    newCurrentCall = this.state.currentCall;
                }
                this.backToForeground();
            } else if (newState === 'established') {
                if (this.state.incomingCall === this.state.currentCall) {
                    //utils.timestampedLog("Incoming call media started");
                    newCurrentCall = this.state.incomingCall;
                    newincomingCall = this.state.incomingCall;
                } else {
                    //utils.timestampedLog("Outgoing call media started");
                    newCurrentCall = this.state.currentCall;
                }
            } else {
                //utils.timestampedLog('Call state changed:', 'We have two calls in unclear state');
            }
        } else if (this.state.incomingCall) {
            //this.backToForeground();
            //utils.timestampedLog('Call state changed: We have one incoming call');
            newincomingCall = this.state.incomingCall;
            newCurrentCall = this.state.incomingCall;

            if (this.state.incomingCall.id === call.id) {
                if (newState === 'terminated') {
                    this.startedByPush = false;
                    //utils.timestampedLog("Incoming call was cancelled");
                    this.setState({showIncomingModal: false});
                    this.hideInternalAlertPanel();
                    newincomingCall = null;
                    newCurrentCall = null;
                    readyDelay = 10;
                } else if (newState === 'accepted') {
                    //utils.timestampedLog("Incoming call was accepted");
                    this.hideInternalAlertPanel();
                    this.backToForeground();
                } else if (newState === 'established') {
                    //utils.timestampedLog("Incoming call media started");
                    this.hideInternalAlertPanel();
                }
            }

        } else if (this.state.currentCall) {
            //utils.timestampedLog('Call state changed: We have one current call');
            newCurrentCall = newState === 'terminated' ? null : call;
            newincomingCall = null;
            if (newState !== 'terminated') {
                this.setState({reconnectingCall: false});
            }
        } else {
            newincomingCall = null;
            newCurrentCall = null;
        }

        /*
        utils.timestampedLog('---currentCall:', newCurrentCall);
        utils.timestampedLog('---incomingCall:', newincomingCall);
        */

        let callsState;

        switch (newState) {
            case 'progress':
                this.callKeeper.setCurrentCallActive(callUUID);
                this.backToForeground();

                this.resetGoToReadyTimer();

                tracks = call.getLocalStreams()[0].getVideoTracks();
                mediaType = (tracks && tracks.length > 0) ? 'video' : 'audio';

                if (mediaType === 'video') {
                    this.speakerphoneOn();
                } else {
                    this.speakerphoneOff();
                }

                if (!this.isConference(call)){
                    InCallManager.startRingback('_BUNDLE_');
                }

                break;

            case 'established':
                callsState = this.state.callsState;
                callsState[callUUID] = {startTime: new Date()};
                this.setState({callsState: callsState});

                this.callKeeper.setCurrentCallActive(callUUID);

                this.backToForeground();
                this.resetGoToReadyTimer();

                tracks = call.getLocalStreams()[0].getVideoTracks();
                mediaType = (tracks && tracks.length > 0) ? 'video' : 'audio';

                InCallManager.start({media: mediaType});

                if (direction === 'outgoing') {
                    this.stopRingback();
                    if (this.state.speakerPhoneEnabled) {
                        this.speakerphoneOn();
                    } else {
                        this.speakerphoneOff();
                    }
                } else {
                    if (mediaType === 'video') {
                        this.speakerphoneOn();
                    } else {
                        this.speakerphoneOff();
                    }
                }

                break;
            case 'accepted':
                callsState = this.state.callsState;
                callsState[callUUID] = {startTime: new Date()};
                this.setState({callsState: callsState});

                this.callKeeper.setCurrentCallActive(callUUID);
                this.backToForeground();
                this.resetGoToReadyTimer();

                if (direction === 'outgoing') {
                    this.stopRingback();
                }
                break;

            case 'terminated':
                let startTime;
                if (callUUID in this.state.callsState) {
                    callsState = this.state.callsState;
                    startTime = callsState[callUUID].startTime;
                    delete callsState[callUUID];
                    this.setState({callsState: callsState});
               }

                this._terminatedCalls.set(callUUID, true);
                utils.timestampedLog(callUUID, direction, 'terminated with reason', data.reason);


                if (this.state.incomingCall && this.state.incomingCall.id === call.id) {
                    newincomingCall = null;
                }

                if (this.state.currentCall && this.state.currentCall.id === call.id) {
                    newCurrentCall = null;
                }

                let callSuccesfull = false;
                let reason = data.reason;
                let play_busy_tone = !this.isConference(call);
                let CALLKEEP_REASON;
                let missed = false;

                if (!reason || reason.match(/200/)) {
                    if (oldState === 'progress' && direction === 'outgoing') {
                        reason = 'Cancelled';
                        play_busy_tone = false;
                    } else if (oldState === 'incoming') {
                        reason = 'Cancelled';
                        missed = true;
                        play_busy_tone = false;
                        CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.UNANSWERED;
                    } else {
                        reason = 'Hangup';
                        callSuccesfull = true;
                        CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED;
                    }
                } else if (reason.match(/402/)) {
                    reason = 'Payment required';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/403/)) {
                    //reason = 'Forbidden';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/404/)) {
                    reason = 'User not found';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/408/)) {
                    reason = 'Timeout';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/480/)) {
                    reason = 'Is not online';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.UNANSWERED;
                } else if (reason.match(/486/)) {
                    reason = 'Is busy';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED;
                    if (direction === 'outgoing') {
                        play_busy_tone = false;
                    }
                } else if (reason.match(/603/)) {
                    reason = 'Cannot answer now';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED;
                    if (direction === 'outgoing') {
                        play_busy_tone = false;
                    }
                } else if (reason.match(/487/)) {
                    reason = 'Cancelled';
                    play_busy_tone = false;
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED;
                } else if (reason.match(/488/)) {
                    reason = 'Unacceptable media';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/5\d\d/)) {
                    reason = 'Server failure';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else if (reason.match(/904/)) {
                    // Sofia SIP: WAT
                    reason = 'Wrong account or password';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                } else {
                    reason = 'Connection failed';
                    CALLKEEP_REASON = CK_CONSTANTS.END_CALL_REASONS.FAILED;
                }

                if (play_busy_tone) {
                    this.playBusyTone();
                }

                if (direction === 'outgoing') {
                    this.setState({declineReason: reason});
                }
                this.stopRingback();

                let msg;
                let current_datetime = new Date();
                let formatted_date = utils.appendLeadingZeroes(current_datetime.getHours()) + ":" + utils.appendLeadingZeroes(current_datetime.getMinutes()) + ":" + utils.appendLeadingZeroes(current_datetime.getSeconds());
                if (startTime) {
                    let duration = moment.duration(new Date() - startTime);

                    if (duration > 3600) {
                        duration = duration.format('hh:mm:ss', {trim: false});
                    } else {
                        duration = duration.format('mm:ss', {trim: false});
                    }

                    msg = formatted_date + " - " + direction +" " + mediaType + " call ended after " + duration;
                } else {
                    msg = formatted_date + " - " + direction +" " + mediaType + " call ended (" + reason + ")";
                }

                this.saveSystemMessage(call.remoteIdentity.uri.toLowerCase(), msg, direction, missed);

                this.callKeeper.endCall(callUUID, CALLKEEP_REASON);

                if (play_busy_tone && oldState !== 'established' && direction === 'outgoing') {
                    this._notificationCenter.postSystemNotification('Call ended:', {body: reason});
                }

                this.updateHistoryEntry(callUUID);

                break;
            default:
                break;
        }

        /*
        utils.timestampedLog('---currentCall end:', newCurrentCall);
        utils.timestampedLog('---incomingCall end:', newincomingCall);
        */

        this.setState({
            currentCall: newCurrentCall,
            incomingCall: newincomingCall
        });

        if (!this.state.currentCall && !this.state.incomingCall) {
            this.speakerphoneOn();

            if (!this.state.reconnectingCall) {
                if (this.state.inFocus) {
                    if (this.currentRoute !== '/ready') {
                        utils.timestampedLog('Will go to ready in', readyDelay/1000, 'seconds (terminated)', callUUID);
                        this.goToReadyTimer = setTimeout(() => {
                            this.changeRoute('/ready', 'no_more_calls');
                        }, readyDelay);
                    }
                } else {
                    if (this.currentRoute !== '/conference') {
                        this.changeRoute('/ready', 'no_more_calls');
                    }
                }
            }
        }

        if (this.state.currentCall) {
            //console.log('Current:', this.state.currentCall.id);
        }
        if (this.state.incomingCall) {
            //console.log('Incoming:', this.state.incomingCall.id);
        }
    }

    goBackToCall() {
        let call = this.state.currentCall || this.state.incomingCall;
        this.setState({inviteContacts: false, selectedContacts: []});

        if (call) {
            if (call.hasOwnProperty('_participants')) {
                this.changeRoute('/conference', 'back to call');
            } else {
                this.changeRoute('/call', 'back to call');
            }
        } else {
            console.log('No call to go back to');
        }
    }

    goBackToHome() {
        this.changeRoute('/ready', 'back to home');
    }

    goBackToHomeFromCall() {
        this.changeRoute('/ready', 'back to home');
        if (this.state.callContact) {
            this.setState({selectedContact: this.state.callContact});
            this.getMessages(this.state.callContact.remoteParty);
        }
    }

    inviteContactsToConference() {
        console.log('Will invite contacts');
        this.setState({inviteContacts: true, selectedContacts: []});
        this.goBackToHome();
    }

    handleRegistration(accountId, password, remember=true) {
        if (this.state.account !== null && this.state.registrationState === 'registered' ) {
            return;
        }

        this.setState({
            accountId : accountId,
            password  : password,
            loading   : 'Connecting...'
        });

        this.loadSylkContacts();

        if (this.state.connection === null) {
            utils.timestampedLog('Web socket handle registration for', accountId);

            const userAgent = 'Sylk Mobile';
            if (this.state.phoneNumber) {
                console.log('Phone number:', this.state.phoneNumber);
            }

            let connection = sylkrtc.createConnection({server: config.wsServer});
            utils.timestampedLog('Web socket', Object.id(connection), 'was opened');
            connection.on('stateChanged', this.connectionStateChanged);
            this.setState({connection: connection});

        } else {
            if (this.state.connection.state === 'ready' && this.state.registrationState !== 'registered') {
                utils.timestampedLog('Web socket', Object.id(this.state.connection), 'handle registration for', accountId);
                this.processRegistration(accountId, password);
            }
        }
    }

    processRegistration(accountId, password, displayName) {
        if (!displayName) {
            displayName = this.state.displayName;
        }

        if (!this.state.connection) {
            return;
        }

        this.updateServerHistory();

        utils.timestampedLog('Process registration for', accountId, '(', displayName, ')');
        if (this.state.account && this.state.connection) {
            this.state.connection.removeAccount(this.state.account,
                (error) => {
                    this.setState({registrationState: null, registrationKeepalive: false});
                }
            );
        }

        const options = {
            account: accountId,
            password: password,
            displayName: displayName || ''
        };

        if (this.state.connection._accounts.has(options.account)) {
            return;
        }

        //utils.timestampedLog('Add register 10 sec timer');
        this.registrationFailureTimer  = setTimeout(() => {
                this.showRegisterFailure('Register timeout');
                this.processRegistration(accountId, password);
        }, 10000);


        const account = this.state.connection.addAccount(options, (error, account) => {
            if (!error) {
                account.on('outgoingCall', this.outgoingCall);
                account.on('conferenceCall', this.outgoingConference);
                account.on('registrationStateChanged', this.registrationStateChanged);
                account.on('incomingCall', this.incomingCallFromWebSocket);
                account.on('incomingMessage', this.incomingMessage);
                account.on('syncConversations', this.syncConversations);
                account.on('readConversation', this.readConversation);
                account.on('removeConversation', this.removeConversation);
                account.on('removeMessage', this.removeMessage);
                account.on('outgoingMessage', this.outgoingMessage);
                account.on('messageStateChanged', this.messageStateChanged);
                account.on('missedCall', this.missedCall);
                account.on('conferenceInvite', this.conferenceInviteFromWebSocket);
                //utils.timestampedLog('Web socket account', account.id, 'is ready, registering...');
                this._sendPushToken(account);
                this.setState({account: account});
                account.register();

                storage.set('account', {
                    accountId: this.state.accountId,
                    password: this.state.password
                });

            } else {
                this.showRegisterFailure(408);
            }
        });
    }

    setDevice(device) {
        const oldDevices = Object.assign({}, this.state.devices);

        if (device.kind === 'videoinput') {
            oldDevices['camera'] = device;
        } else if (device.kind === 'audioinput') {
            oldDevices['mic'] = device;
        }

        this.setState({devices: oldDevices});
        storage.set('devices', oldDevices);
        sylkrtc.utils.closeMediaStream(this.state.localMedia);
        this.getLocalMedia();
    }

    getLocalMedia(mediaConstraints={audio: true, video: true}, nextRoute=null) {    // eslint-disable-line space-infix-ops
        let callType = mediaConstraints.video ? 'video': 'audio';

        utils.timestampedLog('Get local media for', callType, 'call');
        const constraints = Object.assign({}, mediaConstraints);

        if (constraints.video === true) {
            if ((nextRoute === '/conference')) {
                constraints.video = {
                    'width': {
                        'ideal': 640
                    },
                    'height': {
                        'ideal': 480
                    }
                };

            // TODO: remove this, workaround so at least safari works when joining a video conference
            } else if (nextRoute === '/conference' && isSafari) {
                constraints.video = false;
            } else {
                // ask for 720p video
                constraints.video = {
                    'width': {
                        'ideal': 640
                    },
                    'height': {
                        'ideal': 480
                    }
                };
            }
        }

        logger.debug('getLocalMedia(), (modified) mediaConstraints=%o', constraints);

        navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
            devices.forEach((device) => {
                //console.log(device);
                if ('video' in constraints && 'camera' in this.state.devices) {
                    if (constraints.video && constraints.video !== false && (device.deviceId === this.state.devices.camera.deviceId || device.label === this.state.devices.camera.label)) {
                        constraints.video.deviceId = {
                            exact: device.deviceId
                        };
                    }
                }
                if ('mic' in this.state.devices) {
                    if (device.deviceId === this.state.devices.mic.deviceId || device.label === this.state.devices.mic.Label) {
                        // constraints.audio = {
                        //     deviceId: {
                        //         exact: device.deviceId
                        //     }
                        // };
                    }
                }
            });
        })
        .catch((error) => {
            utils.timestampedLog('Error: device enumeration failed:', error);
        })
        .then(() => {
            return navigator.mediaDevices.getUserMedia(constraints)
        })
        .then((localStream) => {
            clearTimeout(this.loadScreenTimer);
            //utils.timestampedLog('Local media acquired');
            this.setState({localMedia: localStream});
            if (nextRoute !== null) {
                this.changeRoute(nextRoute);
            }
        })
        .catch((error) => {
            utils.timestampedLog('Access to local media failed, trying audio only', error);
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            })
            .then((localStream) => {
                clearTimeout(this.loadScreenTimer);

                if (nextRoute !== null) {
                    this.changeRoute(nextRoute, 'local media aquired');
                }
            })
            .catch((error) => {
                utils.timestampedLog('Access to local media failed:', error);
                clearTimeout(this.loadScreenTimer);
                this._notificationCenter.postSystemNotification("Can't access camera or microphone");
                this.setState({
                    loading: null
                });

                this.changeRoute('/ready', 'local media failure');
            });
        });
    }

    getConnection() {
        return this.state.connection ? Object.id(this.state.connection): null;
    }

    callKeepStartConference(targetUri, options={audio: true, video: true, participants: []}) {
        if (!targetUri) {
            return;
        }

        this.resetGoToReadyTimer();

        let callUUID = options.callUUID || uuid.v4();

        let participants = options.participants || null;
        this.addConferenceHistoryEntry(targetUri, callUUID);

        let participantsToInvite = [];

        if (participants) {
            participants.forEach((participant_uri) => {
                if (participant_uri === this.state.accountId) {
                    return;
                }
                participantsToInvite.push(participant_uri);
            });
        }

        this.outgoingMedia = options;

        this.setState({outgoingCallUUID: callUUID,
                       reconnectingCall: false,
                       participantsToInvite: participantsToInvite
                       });

        const media = options.video ? 'video' : 'audio';

        if (participantsToInvite) {
            utils.timestampedLog('Will start', media, 'conference', callUUID, 'to', targetUri, 'with', participantsToInvite);
        } else {
            utils.timestampedLog('Will start', media, 'conference', callUUID, 'to', targetUri);
        }

        this.respawnConnection();
        this.startCallWhenReady(targetUri, {audio: options.audio, video: options.video, conference: true, callUUID: callUUID});
    }

    updateSelection(uri) {
         //console.log('updateSelection', uri);
         let selectedContacts = this.state.selectedContacts;
         //console.log('selectedContacts', selectedContacts);

         let idx = selectedContacts.indexOf(uri);

         if (idx === -1) {
             selectedContacts.push(uri);
         } else {
             selectedContacts.splice(idx, 1);
         }

         this.setState({selectedContacts: selectedContacts});
    }

    callKeepStartCall(targetUri, options) {
        this.resetGoToReadyTimer();
        let callUUID = options.callUUID || uuid.v4();
        this.setState({outgoingCallUUID: callUUID, reconnectingCall: false});
        utils.timestampedLog('User will start call', callUUID, 'to', targetUri);
        this.respawnConnection();
        this.startCallWhenReady(targetUri, {audio: options.audio, video: options.video, callUUID: callUUID});
    }

    startCall(targetUri, options) {
        this.setState({targetUri: targetUri, callContact: this.state.selectedContact});
        this.getLocalMedia(Object.assign({audio: true, video: options.video}, options), '/call');
    }

    timeoutCall(callUUID, uri) {
        utils.timestampedLog('Timeout answering call', callUUID);
        this.addConferenceHistoryEntry(uri, callUUID, direction='received');
        this.forceUpdate();
    }

    closeLocalMedia() {
        if (this.state.localMedia != null) {
            utils.timestampedLog('Close local media');
            sylkrtc.utils.closeMediaStream(this.state.localMedia);
            this.setState({localMedia: null});
        }
    }

    callKeepAcceptCall(callUUID) {
        // called from user interaction with Old alert panel
        // options used to be media to accept audio only but native panels do not have this feature
        utils.timestampedLog('CallKeep will answer call', callUUID);
        this.callKeeper.acceptCall(callUUID);
        this.hideInternalAlertPanel();
    }

    callKeepRejectCall(callUUID) {
        // called from user interaction with Old alert panel
        utils.timestampedLog('CallKeep will reject call', callUUID);
        this.callKeeper.rejectCall(callUUID);
        this.hideInternalAlertPanel();
    }

    acceptCall(callUUID) {
        utils.timestampedLog('User accepted call', callUUID);
        this.hideInternalAlertPanel();

        this.resetGoToReadyTimer();

        if (this.state.currentCall) {
            utils.timestampedLog('Will hangup current call first');
            this.hangupCall(this.state.currentCall.id, 'accept_new_call');
            // call will continue after transition to /ready
        } else {
            utils.timestampedLog('Will get local media now');
            let hasVideo = (this.state.incomingCall && this.state.incomingCall.mediaTypes && this.state.incomingCall.mediaTypes.video) ? true : false;
            this.getLocalMedia(Object.assign({audio: true, video: hasVideo}), '/call');
        }
    }

    rejectCall(callUUID) {
        // called by Call Keep when user rejects call
        utils.timestampedLog('User rejected call', callUUID);
        this.hideInternalAlertPanel();

        if (!this.state.currentCall) {
            this.changeRoute('/ready', 'rejected');
        }

        if (this.state.incomingCall && this.state.incomingCall.id === callUUID) {
            utils.timestampedLog('Sylkrtc terminate call', callUUID, 'in', this.state.incomingCall.state, 'state');
            this.state.incomingCall.terminate();
        }
    }

    hangupCall(callUUID, reason) {
        utils.timestampedLog('Call', callUUID, 'hangup with reason:', reason);

        let call = this.callKeeper._calls.get(callUUID);
        let direction = null;
        let targetUri = null;

        if (call) {
            let direction = call.direction;
            utils.timestampedLog('Sylkrtc terminate call', callUUID, 'in', call.state, 'state');
            call.terminate();
        }

        if (this.busyToneInterval) {
            clearInterval(this.busyToneInterval);
            this.busyToneInterval = null;
        }

        if (reason === 'outgoing_connection_failed') {
             this.setState({reconnectingCall: true, outgoingCallUUID: uuid.v4()});
             return;
        }

        if (reason === 'user_cancel_call' ||
            reason === 'user_hangup_call' ||
            reason === 'answer_failed' ||
            reason === 'callkeep_hangup_call' ||
            reason === 'accept_new_call' ||
            reason === 'stop_preview' ||
            reason === 'escalate_to_conference' ||
            reason === 'user_hangup_conference_confirmed' ||
            reason === 'timeout'
            ) {
            this.changeRoute('/ready', reason);
        } else if (reason === 'user_hangup_conference') {
            utils.timestampedLog('Save conference maybe?');
            setTimeout(() => {
                 this.changeRoute('/ready', 'conference_really_ended');
            }, 15000);
        } else if (reason === 'user_cancelled_conference') {
            utils.timestampedLog('Save conference maybe?');
            setTimeout(() => {
                 this.changeRoute('/ready', 'conference_really_ended');
            }, 15000);
        } else {
            utils.timestampedLog('Will go to ready in 6 seconds (hangup)');
            setTimeout(() => {
                 this.changeRoute('/ready', reason);
            }, 6000);
        }
    }

    playBusyTone() {
        //utils.timestampedLog('Play busy tone');
        InCallManager.stop({busytone: '_BUNDLE_'});
    }

    callKeepSendDtmf(digits) {
        utils.timestampedLog('Send DTMF', digits);
        if (this.state.currentCall) {
            this.callKeeper.sendDTMF(this.state.currentCall.id, digits);
        }
    }

    toggleProximity() {
        storage.set('proximityEnabled', !this.state.proximityEnabled);

        if (!this.state.proximityEnabled) {
            utils.timestampedLog('Proximity sensor enabled');
        } else {
            utils.timestampedLog('Proximity sensor disabled');
        }
        this.setState({proximityEnabled: !this.state.proximityEnabled});
    }

    toggleMute(callUUID, mute) {
        utils.timestampedLog('Toggle mute for call', callUUID, ':', mute);
        this.callKeeper.setMutedCall(callUUID, mute);
        this.setState({muted: mute});
    }

    async toggleImportPrivateKeyModal() {
        if (this.state.showImportPrivateKeyModal) {
            this.setState({privateKey: null,
                           privateKeyImportStatus: '',
                           privateKeyImportSuccess: false});
        }
        this.setState({showImportPrivateKeyModal: !this.state.showImportPrivateKeyModal});
    }

    togglePinned() {
        this.setState({pinned: !this.state.pinned});
    }

    toggleSpeakerPhone() {
        if (this.state.speakerPhoneEnabled === true) {
            this.speakerphoneOff();
        } else {
            this.speakerphoneOn();
        }
    }

    speakerphoneOn() {
        utils.timestampedLog('Speakerphone On');
        this.setState({speakerPhoneEnabled: true});
        InCallManager.setForceSpeakerphoneOn(true);
    }

    speakerphoneOff() {
        utils.timestampedLog('Speakerphone Off');
        this.setState({speakerPhoneEnabled: false});
        InCallManager.setForceSpeakerphoneOn(false);
    }

    startGuestConference(targetUri) {
        this.setState({targetUri: targetUri});
        this.getLocalMedia({audio: true, video: true});
    }

    outgoingCall(call) {
        // called by sylkrtc.js when an outgoing call starts

        const localStreams = call.getLocalStreams();
        let mediaType = 'audio';
        let hasVideo = false;

        if (localStreams.length > 0) {
            const localStream = call.getLocalStreams()[0];
            mediaType = localStream.getVideoTracks().length > 0 ? 'video' : 'audio';
            hasVideo = localStream.getVideoTracks().length > 0 ? true : false;
        }

        this.callKeeper.startOutgoingCall(call.id, call.remoteIdentity.uri, hasVideo);

        utils.timestampedLog('Outgoing', mediaType, 'call', call.id, 'started to', call.remoteIdentity.uri);
        this.callKeeper.addWebsocketCall(call);

        call.on('stateChanged', this.callStateChanged);
        this.setState({currentCall: call});
    }

    outgoingConference(call) {
        // called by sylrtc.js when an outgoing conference starts

        const localStreams = call.getLocalStreams();
        let mediaType = 'audio';
        let hasVideo = false;

        if (localStreams.length > 0) {
            const localStream = call.getLocalStreams()[0];
            mediaType = localStream.getVideoTracks().length > 0 ? 'video' : 'audio';
            hasVideo = localStream.getVideoTracks().length > 0 ? true : false;
        }

        this.callKeeper.startOutgoingCall(call.id, call.remoteIdentity.uri, hasVideo);

        utils.timestampedLog('Outgoing', mediaType, 'conference', call.id, 'started to', call.remoteIdentity.uri);
        this.callKeeper.addWebsocketCall(call);

        call.on('stateChanged', this.callStateChanged);
        this.setState({currentCall: call});
    }

    _onLocalNotificationReceivedBackground(notification) {
        let notificationContent = notification.getData();
        utils.timestampedLog('Handle local iOS PUSH notification: ', notificationContent);
    }

    _onNotificationReceivedBackground(notification) {
        let notificationContent = notification.getData();

        const event = notificationContent['event'];
        const callUUID = notificationContent['session-id'];
        const to = notificationContent['to_uri'];
        const from = notificationContent['from_uri'];
        const displayName = notificationContent['from_display_name'];
        const outgoingMedia = {audio: true, video: notificationContent['media-type'] === 'video'};
        const mediaType = notificationContent['media-type'] || 'audio';

          /*
           * Local Notification Payload
           *
           * - `alertBody` : The message displayed in the notification alert.
           * - `alertAction` : The "action" displayed beneath an actionable notification. Defaults to "view";
           * - `soundName` : The sound played when the notification is fired (optional).
           * - `category`  : The category of this notification, required for actionable notifications (optional).
           * - `userInfo`  : An optional object containing additional notification data.
           */

        if (event === 'incoming_session') {
            utils.timestampedLog('Push notification: incoming call', callUUID);
            this.startedByPush = true;
            this.incomingCallFromPush(callUUID, from, displayName, mediaType);

        } else if (event === 'incoming_conference_request') {
            utils.timestampedLog('Push notification: incoming conference', callUUID);
            this.startedByPush = true;
            this.incomingConference(callUUID, to, from, displayName, outgoingMedia);

        } else if (event === 'cancel') {
            utils.timestampedLog('Push notification: cancel call', callUUID);
            VoipPushNotification.presentLocalNotification({alertBody:'Call cancelled'});
            this.callKeeper.endCall(callUUID, CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
        }

        /*
        if (notificationContent['event'] === 'incoming_session') {
            VoipPushNotification.presentLocalNotification({
                alertBody:'Incoming ' + notificationContent['media-type'] + ' call from ' + notificationContent['from_display_name']
            });
        }
        */

        if (VoipPushNotification.wakeupByPush) {
            utils.timestampedLog('We wake up by push notification');
            VoipPushNotification.wakeupByPush = false;
            VoipPushNotification.onVoipNotificationCompleted(callUUID);
        }
    }


    backToForeground() {
        if (this.state.appState !== 'active') {
            this.callKeeper.backToForeground();
        }

        if (this.state.accountId) {
            this.handleRegistration(this.state.accountId, this.state.password);
        }
    }

    incomingConference(callUUID, to, from, displayName, outgoingMedia={audio: true, video: true}) {
        if (this.unmounted) {
            return;
        }

        const mediaType = outgoingMedia.video ? 'video' : 'audio';

        utils.timestampedLog('Incoming', mediaType, 'conference invite from', from, displayName, 'to room', to);

        if (this.state.account && from === this.state.account.id) {
            utils.timestampedLog('Reject conference call from myself', callUUID);
            this.callKeeper.rejectCall(callUUID);
            return;
        }

        if (this.autoRejectIncomingCall(callUUID, from, to)) {
            return;
        }

        this.setState({incomingCallUUID: callUUID});
        this.callKeeper.handleConference(callUUID, to, from, displayName, mediaType, outgoingMedia);
    }

    startConference(targetUri, options={audio: true, video: true, participants: []}) {
        utils.timestampedLog('New outgoing conference to room', targetUri);
        this.setState({targetUri: targetUri});
        this.getLocalMedia({audio: options.audio, video: options.video}, '/conference');
    }

    escalateToConference(participants) {
        let outgoingMedia = {audio: true, video: true};
        let mediaType = 'video';
        let call;

        if (this.state.currentCall) {
            call = this.state.currentCall;
        } else if (this.state.incomingCall) {
            call = this.state.currentCall;
        } else {
            console.log('No call to escalate');
            return
        }

        const localStreams = call.getLocalStreams();
        if (localStreams.length > 0) {
            const localStream = call.getLocalStreams()[0];
            if (localStream.getVideoTracks().length == 0) {
                outgoingMedia.video = false;
                mediaType = 'audio';
            }
        }

        this.outgoingMedia = outgoingMedia;
        this.participantsToInvite = participants;

        console.log('Escalate', mediaType, 'call', call.id, 'to conference with', participants.toString());
        this.hangupCall(call.id, 'escalate_to_conference');
    }

    conferenceInviteFromWebSocket(data) {
        // comes from web socket
        utils.timestampedLog('Conference invite from websocket', data.id, 'from', data.originator, 'for room', data.room);
        if (this.isConference()) {
            return;
        }
        //this._notificationCenter.postSystemNotification('Expecting conference invite', {body: `from ${data.originator.displayName || data.originator.uri}`});
    }

    updateLinkingURL = (event) => {
        // this handles the use case where the app is running in the background and is activated by the listener...
        //console.log('Updated Linking url', event.url);
        this.eventFromUrl(event.url);
        DeepLinking.evaluateUrl(event.url);
    }

    eventFromUrl(url) {
        url = decodeURI(url);

        try {
            let direction;
            let event;
            let callUUID;
            let from;
            let to;
            let displayName;

            var url_parts = url.split("/");
            let scheme = url_parts[0];
            //console.log(url_parts);

            if (scheme === 'sylk:') {
                //sylk://conference/incoming/callUUID/from/to/media - when Android is asleep
                //sylk://call/outgoing/callUUID/to/displayName - from system dialer/history
                //sylk://call/incoming/callUUID/from/to/displayName - when Android is asleep
                //sylk://call/cancel//callUUID - when Android is asleep

                event       = url_parts[2];
                direction   = url_parts[3];
                callUUID    = url_parts[4];
                from        = url_parts[5];
                to          = url_parts[6];
                displayName = url_parts[7];
                mediaType   = url_parts[8] || 'audio';

                if (event !== 'cancel' && from && from.search('@videoconference.') > -1) {
                    event = 'conference';
                    to = from;
                }

                this.setState({targetUri: from});

            } else if (scheme === 'https:') {
                // https://webrtc.sipthor.net/conference/DaffodilFlyChill0 from external web link
                // https://webrtc.sipthor.net/call/alice@example.com from external web link
                direction = 'outgoing';
                event = url_parts[3];
                to = url_parts[4];
                callUUID = uuid.v4();

                if (to.indexOf('@') === -1 && event === 'conference') {
                    to = url_parts[4] + '@' + config.defaultConferenceDomain;
                } else if (to.indexOf('@') === -1 && event === 'call') {
                    to = url_parts[4] + '@' + this.state.defaultDomain;
                }
                this.setState({targetUri: to});
            }

            if (event === 'conference') {
                utils.timestampedLog('Conference from external URL:', url);
                this.startedByPush = true;

                if (direction === 'outgoing' && to) {
                    utils.timestampedLog('Outgoing conference to', to);
                    this.backToForeground();
                    this.callKeepStartConference(to, {audio: true, video: true, callUUID: callUUID});
                } else if (direction === 'incoming' && from) {
                    utils.timestampedLog('Incoming conference from', from);
                    // allow app to wake up
                    this.backToForeground();
                    const media = {audio: true, video: mediaType === 'video'}
                    this.incomingConference(callUUID, to, from, displayName, media);
                }

            } else if (event === 'call') {
                this.startedByPush = true;
                if (direction === 'outgoing') {
                    utils.timestampedLog('Call from external URL:', url);
                    utils.timestampedLog('Outgoing call to', from);
                    this.backToForeground();
                    this.callKeepStartCall(from, {audio: true, video: false, callUUID: callUUID});
                } else if (direction === 'incoming') {
                    utils.timestampedLog('Call from external URL:', url);
                    utils.timestampedLog('Incoming call from', from);
                    this.backToForeground();
                    this.incomingCallFromPush(callUUID, from, displayName, mediaType, true);
                } else if (direction === 'cancel') {
                    this.cancelIncomingCall(callUUID);
                }


            } else {
                 utils.timestampedLog('Error: Invalid external URL event', event);
            }
        } catch (err) {
            utils.timestampedLog('Error parsing URL', url, ":", err);
        }
    }

    autoRejectIncomingCall(callUUID, from, to) {
        //utils.timestampedLog('Check auto reject call from', from);
        if (this.state.blockedUris && this.state.blockedUris.indexOf(from) > -1) {
            utils.timestampedLog('Reject call', callUUID, 'from blocked URI', from);
            this.callKeeper.rejectCall(callUUID);
            this._notificationCenter.postSystemNotification('Call rejected', {body: `from ${from}`});
            return true;
        }

        const fromDomain = '@' + from.split('@')[1]
        if (this.state.blockedUris && this.state.blockedUris.indexOf(fromDomain) > -1) {
            utils.timestampedLog('Reject call', callUUID, 'from blocked domain', fromDomain);
            this.callKeeper.rejectCall(callUUID);
            this._notificationCenter.postSystemNotification('Call rejected', {body: `from domain ${fromDomain}`});
            return true;
        }

        if (this.state.currentCall && this.state.incomingCall && this.state.currentCall === this.state.incomingCall && this.state.incomingCall.id !== callUUID) {
            utils.timestampedLog('Reject second incoming call');
            this.callKeeper.rejectCall(callUUID);
        }

        if (this.state.account && from === this.state.account.id && this.state.currentCall && this.state.currentCall.remoteIdentity.uri === from) {
            utils.timestampedLog('Reject call to myself', callUUID);
            this.callKeeper.rejectCall(callUUID);
            return true;
        }

        if (this._terminatedCalls.has(callUUID)) {
            utils.timestampedLog('Reject call already terminated', callUUID);
            this.cancelIncomingCall(callUUID);
            return true;
        }

        if (this.isConference()) {
            utils.timestampedLog('Reject call while in a conference', callUUID);
            if (to !== this.state.targetUri) {
                this._notificationCenter.postSystemNotification('Missed call from', {body: from});
            }
            this.callKeeper.rejectCall(callUUID);
            return true;
        }

        if (this.state.currentCall && this.state.currentCall.state === 'progress' && this.state.currentCall.remoteIdentity.uri !== from) {
            utils.timestampedLog('Reject call while outgoing in progress', callUUID);
            this.callKeeper.rejectCall(callUUID);
            this._notificationCenter.postSystemNotification('Missed call from', {body: from});
            return true;
        }

        return false;
    }

    autoAcceptIncomingCall(callUUID, from) {
        // TODO: handle ping pong where we call each other back
        if (this.state.currentCall &&
            this.state.currentCall.direction === 'outgoing' &&
            this.state.currentCall.state === 'progress' &&
            this.state.currentCall.remoteIdentity.uri === from) {

                this.hangupCall(this.state.currentCall.id, 'accept_new_call');
                this.setState({currentCall: null});

                utils.timestampedLog('Auto accept incoming call from same address I am calling', callUUID);
                return true;
        }

        return false;
    }

    incomingCallFromPush(callUUID, from, displayName, mediaType, force) {
        //utils.timestampedLog('Handle incoming PUSH call', callUUID, 'from', from, '(', displayName, ')');

        if (this.unmounted) {
            return;
        }

        if (this.autoRejectIncomingCall(callUUID, from)) {
            return;
        }

        //this.showInternalAlertPanel();

        if (this.autoAcceptIncomingCall(callUUID, from)) {
            return;
        }

        this.goToReadyNowAndCancelTimer();

        this.setState({targetUri: from});

        let skipNativePanel = false;

        if (!this.callKeeper._calls.get(callUUID) || (this.state.currentCall && this.state.currentCall.direction === 'outgoing')) {
            //this._notificationCenter.postSystemNotification('Incoming call', {body: `from ${from}`});
            if (Platform.OS === 'android' && this.state.appState === 'foreground') {
                skipNativePanel = true;
            }
        }

        this.callKeeper.incomingCallFromPush(callUUID, from, displayName, mediaType, force, skipNativePanel);

    }

    incomingCallFromWebSocket(call, mediaTypes) {

        if (this.unmounted) {
            return;
        }

        this.callKeeper.addWebsocketCall(call);

        const callUUID = call.id;
        const from = call.remoteIdentity.uri;

        //utils.timestampedLog('Handle incoming web socket call', callUUID, 'from', from, 'on connection', Object.id(this.state.connection));

        // because of limitation in Sofia stack, we cannot have more then two calls at a time
        // we can have one outgoing call and one incoming call but not two incoming calls
        // we cannot have two incoming calls, second one is automatically rejected by sylkrtc.js

        if (this.autoRejectIncomingCall(callUUID, from)) {
            return;
        }

        const autoAccept = this.autoAcceptIncomingCall(callUUID, from);

        this.goToReadyNowAndCancelTimer();

        call.mediaTypes = mediaTypes;

        call.on('stateChanged', this.callStateChanged);

        this.setState({incomingCall: call});

        let skipNativePanel = false;

        if (this.state.currentCall && this.state.currentCall.direction === 'outgoing') {
            if (Platform.OS === 'android') {
                this.showInternalAlertPanel();
                skipNativePanel = true;
            }
        }

        this.callKeeper.incomingCallFromWebSocket(call, autoAccept, skipNativePanel);
    }

    missedCall(data) {
        utils.timestampedLog('Missed call from ' + data.originator.uri, '(', data.originator.displayName, ')');

        /*
        let msg;
        let current_datetime = new Date();
        let formatted_date = utils.appendLeadingZeroes(current_datetime.getHours()) + ":" + utils.appendLeadingZeroes(current_datetime.getMinutes()) + ":" + utils.appendLeadingZeroes(current_datetime.getSeconds());
        msg = formatted_date + " - missed call";
        this.saveSystemMessage(data.originator.uri.toLowerCase(), msg, 'incoming', true);
        */

        if (!this.state.currentCall) {
            let from = data.originator.displayName ||  data.originator.uri;
            this._notificationCenter.postSystemNotification('Missed call', {body: `from ${from}`});
            if (Platform.OS === 'ios') {
                VoipPushNotification.presentLocalNotification({alertBody:'Missed call from ' + from});
            }
        }

        this.updateServerHistory()
    }

    updateServerHistory() {
        if (this.currentRoute === '/ready') {
            this.setState({refreshHistory: !this.state.refreshHistory});
        }
    }

    startPreview() {
        this.getLocalMedia({audio: true, video: true}, '/preview');
    }

    updateHistoryEntry(callUUID) {
        let newHistory = this.state.localHistory;
        var historyItem = this.findObjectByKey(newHistory, 'sessionId', callUUID);
        if (historyItem) {
            let current_datetime = new Date();
            let stopTime = current_datetime.getFullYear() + "-" + utils.appendLeadingZeroes(current_datetime.getMonth() + 1) + "-" + utils.appendLeadingZeroes(current_datetime.getDate()) + " " + utils.appendLeadingZeroes(current_datetime.getHours()) + ":" + utils.appendLeadingZeroes(current_datetime.getMinutes()) + ":" + utils.appendLeadingZeroes(current_datetime.getSeconds());
            historyItem.stopTime = stopTime;
            var diff = current_datetime.getTime() - historyItem.startTimeObject.getTime();
            historyItem.duration = parseInt(diff/1000);
            delete historyItem['startTimeObject'];
            if (this._historyConferenceParticipants.has(callUUID)) {
                historyItem.participants = this._historyConferenceParticipants.get(callUUID);
            } else {
                historyItem.participants = [];
            }
            this.setState({localHistory: newHistory});
            storage.set('history', newHistory);
        }
    }

    sendPublicKey(uri) {
        if (!uri) {
            console.log('Missing uri, cannot send public key');
        }

        if (uri === this.state.accountId) {
            return;
        }

        // Send outgoing messages
        if (this.state.account && this.state.keys && this.state.keys.public) {
            console.log('Sending public key to', uri);
            this.state.account.sendMessage(uri, this.state.keys.public, 'text/pgp-public-key');
        } else {
            console.log('No public key available');
        }
    }

    async saveOutgoingRawMessage(id, from_uri, to_uri, content, contentType) {
        let timestamp = new Date();
        let params;
        params = [id, JSON.stringify(timestamp), content, contentType, from_uri, to_uri, "outgoing", "1"];
        await this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, pending) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            //console.log('SQL insert message OK');
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    async saveSylkContact(uri, contact) {
        if (!contact) {
            contact = this.newContact(uri);
        } else {
            contact = this.sanitizeContact(uri, contact);
        }

        //console.log('saveSylkContact', contact);
        if (this.sql_contacts_keys.indexOf(uri) > -1) {
            this.updateSylkContact(uri, contact);
            return;
        }

        let params;
        let blocked = contact.blocked ? 1: 0;
        let favorite = contact.favorite ? 1: 0;
        let current_datetime = new Date();

        const unixTime = Math.floor(current_datetime / 1000);
        contact.timestamp = current_datetime;

        let tags = contact.tags.toString();
        let participants = contact.participants.toString();
        let unread_messages = contact.unread.toString();

        params = [this.state.accountId, unixTime, contact.uri, contact.name || '', contact.organization || '', unread_messages || '', tags || '', participants || '', blocked, favorite, contact.publicKey || ''];
        await this.ExecuteQuery("INSERT INTO contacts (account, timestamp, uri, name, organization, unread_messages, tags, participants, blocked, favorite, public_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            //console.log('SQL inserted contact', contact.uri);
            this.sql_contacts_keys.push(contact.uri);
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') > -1) {
                this.updateSylkContact(uri, contact);
            } else {
                console.log('Save contact SQL error:', error);
            }
        });

        let myContacts = this.state.myContacts;
        myContacts[uri] = contact;

        let myInvitedParties = this.state.myInvitedParties;
        let room = uri.split('@')[0];

        if (room in myInvitedParties) {
            myInvitedParties[room] = contact.participants;
        }

        this.setState({myContacts: myContacts, myInvitedParties: myInvitedParties});
    }

    async deleteSylkContact(uri) {
        await this.ExecuteQuery("DELETE from contacts where uri = ?", [uri]).then((result) => {
            //console.log('SQL deleted contact', uri);
        }).catch((error) => {
            console.log('Delete contact SQL error:', error);
        });

        let myInvitedParties = this.state.myInvitedParties;
        let room = uri.split('@')[0];

        if (room in myInvitedParties) {
            delete myInvitedParties[room];
            this.setState({myInvitedParties: myInvitedParties});
        }

        let myContacts = this.state.myContacts;
        if (uri in myContacts) {
            delete myContacts[uri];
            this.setState({myContacts: myContacts});
        }
    }

    async updateSylkContact(uri, contact) {
        let unixTime = Math.floor(contact.timestamp / 1000);
        let blocked = contact.blocked ? 1: 0;
        let favorite = contact.favorite ? 1: 0;
        let unread_messages = contact.unread.toString();
        let tags = contact.tags.toString();
        let participants = contact.participants.toString();
        let params = [unixTime, contact.name || '', contact.organization || '', blocked, favorite, unread_messages || '', contact.publicKey || '', tags, participants, contact.uri, this.state.accountId];

        await this.ExecuteQuery("update contacts set timestamp = ?, name = ?, organization = ?, blocked = ?, favorite = ?, unread_messages = ?, public_key = ?, tags = ? , participants = ? where uri = ? and account = ?", params).then((result) => {
            //console.log('SQL updated contact', contact.uri);
        }).catch((error) => {
            console.log('SQL error:', error);
        });

        let myContacts = this.state.myContacts;
        myContacts[uri] = contact;
        let myInvitedParties = this.state.myInvitedParties;
        let room = uri.split('@')[0];

        if (room in myInvitedParties) {
            myInvitedParties[room] = contact.participants;
        }

        this.setState({myContacts: myContacts, myInvitedParties: myInvitedParties});
    }

    async replicatePrivateKey(password) {
        if (!this.state.account) {
            console.log('No account');
            return;
        }

        password = password.trim();
        const public_key = this.state.keys.public.replace(/\r/g, '').trim();
        const private_key = this.state.keys.private.replace(/\r/g, '').trim();

        const publicKeyHash = await RNSimpleCrypto.SHA.sha1(public_key);
        const privateKeyHash = await RNSimpleCrypto.SHA.sha1(private_key);

        const publicKeyHashContainer  = "--PUBLIC KEY SHA1 CHECKSUM--" + publicKeyHash + "--";
        const privateKeyHashContainer = "--PRIVATE KEY SHA1 CHECKSUM--" + privateKeyHash + "--";

        const keyPair = 'THIS IS THE KEY PAIR:\n' + this.state.keys.public + '\n' + this.state.keys.private + '\n' + publicKeyHashContainer + '\n' + privateKeyHashContainer;

        await OpenPGP.encryptSymmetric(keyPair, password, KeyOptions).then((encryptedBuffer) => {
            utils.timestampedLog('Sending encrypted private key');
            this.state.account.sendMessage(this.state.account.id, encryptedBuffer, 'text/pgp-private-key');
        }).catch((error) => {
            console.log('Error encrypting private key:', error);
        });
    }

    async syncPrivateKeys(password) {
        utils.timestampedLog('Save encrypted private key');
        password = password.trim();
        await OpenPGP.decryptSymmetric(this.state.privateKey, password).then((keyPair) => {
            utils.timestampedLog('Decrypted PGP private pair');
            this.processPrivateKey(keyPair);
        }).catch((error) => {
            this.setState({privateKeyImportStatus: 'No key received'});
            console.log('Error decrypting PGP private key:', error);
            return
        });
    }

    async processPrivateKey(keyPair) {
        utils.timestampedLog('Process key');
        keyPair = keyPair.replace(/\r/g, '').trim();

        let public_key;
        let private_key;
        let status;
        let keys = this.state.keys || {};

        let regexp;
        let match;

        regexp = /(-----BEGIN PGP PUBLIC KEY BLOCK-----[^]*-----END PGP PUBLIC KEY BLOCK-----)/ig;
        match = keyPair.match(regexp);
        if (match.length === 1) {
            public_key = match[0];
        }

        regexp = /(-----BEGIN PGP PRIVATE KEY BLOCK-----[^]*-----END PGP PRIVATE KEY BLOCK-----)/ig;
        match = keyPair.match(regexp);
        if (match.length === 1) {
            private_key = match[0];
        }

        if (public_key && private_key) {
            if (keys.private !== private_key && keys.public !== public_key) {
                let new_keys = {private: private_key, public: public_key}
                this.saveKeySql(new_keys);
                status = 'Private key copied successfully';

            } else {
                status = 'Private key is the same';
            }

            this.setState({privateKeyImportStatus: status,
                           privateKeyImportSuccess: true});

            this.lastSyncedMessageId = null;
            storage.set('lastSyncedMessageId', this.lastSyncedMessageId);
            if (this.state.account) {
                this.state.account.syncConversations();
            }

        } else {
            this.setState({privateKeyImportStatus: 'Incorrect password!',
                           privateKeyImportSuccess: false});
        }
    }

    async savePublicKey(uri, key) {
        if (!key) {
            console.log('Missing key');
            return;
        }

        key = key.replace(/\r/g, '').trim();

        if (!key.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
            console.log('Cannot find the start of PGP public key');
            return;
        }

        if (!key.endsWith("-----END PGP PUBLIC KEY BLOCK-----")) {
            console.log('Cannot find the end of PGP public key');
            return;
        }

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            myContacts[uri] = {};
        }

        if (myContacts[uri].publicKey === key) {
            //console.log('Public key of', uri, 'did not change');
            return;
        }

        utils.timestampedLog('Public key of', uri, 'saved');

        this.saveSystemMessage(uri, 'Public key received', 'incoming');
        //this.saveSystemMessage(uri, 'Key id ' + publicKeyHash, 'incoming');

        myContacts[uri].publicKey = key;
        this.saveSylkContact(uri, myContacts[uri]);
        this.sendPublicKey(uri);
    }

    async savePublicKeySync(uri, key) {
        console.log('Sync public key from', uri);
        if (!key) {
            console.log('Missing key');
            return;
        }

        key = key.replace(/\r/g, '').trim();

        if (!key.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
            console.log('Cannot find the start of PGP public key');
            return;
        }

        if (!key.endsWith("-----END PGP PUBLIC KEY BLOCK-----")) {
            console.log('Cannot find the end of PGP public key');
            return;
        }

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            myContacts[uri] = {};
        }

        if (myContacts[uri].publicKey === key) {
            console.log('Public key of', uri, 'did not change');
            return;
        }

        console.log('Public key of', uri, 'saved');

        myContacts[uri].publicKey = key;
        this.saveSylkContact(uri, myContacts[uri]);
    }

    _sendMessage(uri, text, id, contentType='text/plain') {
        // Send outgoing messages
        if (this.state.account) {
            //console.log('Send', contentType, 'message', id, 'to', uri);
            let message = this.state.account.sendMessage(uri, text, contentType, {id: id});
            //console.log(message);
            //message.on('stateChanged', (oldState, newState) => {this.outgoingMessageStateChanged(message.id, oldState, newState)})
        }
    }

    async sendMessage(uri, message) {
        message.sent = false;
        message.received = false;
        message.pending = true;

        message.direction = 'outgoing';

        this.saveOutgoingMessage(uri, message);

        let renderMessages = this.state.messages;
        if (Object.keys(renderMessages).indexOf(uri) === -1) {
            renderMessages[uri] = [];
        }

        renderMessages[uri].push(message);
        this.setState({messages: renderMessages});

        if (message.contentType !== 'text/pgp-public-key') {
            let public_keys = this.state.keys.public;

            if (uri in this.state.myContacts && this.state.myContacts[uri].publicKey) {
                public_keys = public_keys + "\n" + this.state.myContacts[uri].publicKey;
            }

            await OpenPGP.encrypt(message.text, public_keys).then((encryptedMessage) => {
                this._sendMessage(uri, encryptedMessage, message._id);
            }).catch((error) => {
                console.log('Failed to encrypt message:', error);
            });

        } else {
            console.log('Outgoing non-encrypted message to', uri);
            this._sendMessage(uri, message.text, message._id);
        }
    }

    async reSendMessage(message, uri) {
        await this.deleteMessage(message._id, uri).then((result) => {
            message._id = uuid.v4();
            message.createdAt = new Date();
            this.sendMessage(uri, message);
        }).catch((error) => {
            console.log('Failed to delete old messages');
        });
    }

    async saveOutgoingMessage(uri, message) {
        this.saveOutgoingChatUri(uri, message.text);
        //console.log('saveOutgoingMessage', message.text);
        let params = [message._id, JSON.stringify(message.createdAt), message.text, "text/plain", this.state.accountId, uri, "outgoing", "1"];
        await this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, pending) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            //console.log('SQL insert message OK');
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    async saveConferenceMessage(uri, message) {
        let params = [message._id, JSON.stringify(message.createdAt), message.text, "text/plain", this.state.accountId, uri, "outgoing", (message.pending ? 1: 0), message.sent ? 1: 0, message.received ? 1: 0];
        await this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, pending, sent, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            //console.log('SQL insert message OK');
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    async outgoingMessageStateChanged(id, state) {
        let query;

        // mark message status
        // state can be failed or accepted

        utils.timestampedLog('Outgoing message', id, 'is', state);


        if (state === 'accepted') {
            query = "UPDATE messages set pending = 0 where msg_id = '" + id + "'";
        }

        //console.log(query);
        if (query) {
            await this.ExecuteQuery(query).then((results) => {
                this.updateRenderMessage(id, state);
                // console.log('SQL update OK');
            }).catch((error) => {
                console.log('SQL query:', query);
                console.log('SQL error:', error);
            });
        }
    }

    async messageStateChanged(obj) {
        // valid API states: pending -> accepted -> delivered -> displayed,
        // error, failed or forbidden
        // valid UI render states: pending, read, received

        let id = obj.messageId;
        let state = obj.state;

        utils.timestampedLog('Message', id, 'is', state);

        let query;

        if (state == 'accepted') {
            query = "UPDATE messages set pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'delivered') {
            query = "UPDATE messages set pending = 0, sent = 1 where msg_id = '" + id + "'";
        } else if (state == 'displayed') {
            query = "UPDATE messages set received = 1, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'received') {
            query = "UPDATE messages set sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'failed') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'error') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'forbidden') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        }

        //console.log(query);
        await this.ExecuteQuery(query).then((results) => {
            this.updateRenderMessage(id, state);
            this.lastSyncedMessageId = id;
            storage.set('lastSyncedMessageId', this.lastSyncedMessageId);
            // console.log('SQL update OK');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    messageStateChangedSync(obj) {
        // valid API states: pending -> accepted -> delivered -> displayed,
        // error, failed or forbidden
        // valid UI render states: pending, read, received

        let id = obj.messageId;
        let state = obj.state;

        //console.log('Sync message', id, 'state', state);

        let query;

        if (state == 'accepted') {
            query = "UPDATE messages set pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'delivered') {
            query = "UPDATE messages set pending = 0, sent = 1 where msg_id = '" + id + "'";
        } else if (state == 'displayed') {
            query = "UPDATE messages set received = 1, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'received') {
            query = "UPDATE messages set sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'failed') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'error') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        } else if (state == 'forbidden') {
            query = "UPDATE messages set received = 0, sent = 1, pending = 0 where msg_id = '" + id + "'";
        }

        //console.log(query);
        this.ExecuteQuery(query).then((results) => {
            //console.log('SQL update OK');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async deleteMessage(id, uri, local=true) {
        utils.timestampedLog('Message', id, 'is deleted');
        let query;
        // TODO send request to server
        query = "DELETE from messages where msg_id = '" + id + "'";
        //console.log(query);
        if (local) {
            this.addJournal(id, 'removeMessage', {uri: uri});
        }
        await this.ExecuteQuery(query).then((results) => {
            this.deleteRenderMessage(id, uri);
            // console.log('SQL update OK');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async deleteMessageSync(id, uri) {
        //console.log('Sync message', id, 'is deleted');
        let query;
        query = "DELETE from messages where msg_id = '" + id + "'";
        this.ExecuteQuery(query).then((results) => {
            this.deleteRenderMessage(id, uri);
            // console.log('SQL update OK');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async expireMessage(id, duration=300) {
        utils.timestampedLog('Expire message', id, 'in', duration, 'seconds after read');
        // TODO expire message
    }

    async deleteRenderMessage(id, uri) {
        if (uri.indexOf('@videoconference.') > -1) {
            uri = uri.split('@')[0];
        }

        let changes = false;
        let renderedMessages = this.state.messages;
        let newRenderedMessages = [];
        let myContacts = this.state.myContacts;
        let existingMessages = [];

        if (uri in this.state.messages) {
            existingMessages = renderedMessages[uri];
            existingMessages.forEach((m) => {
                if (m._id !== id) {
                    newRenderedMessages.push(m);
                } else {
                    changes = true;
                }
            });
        }

        if (changes) {
            renderedMessages[uri] = newRenderedMessages;
            if (uri in myContacts) {
                myContacts[uri].totalMessages = myContacts[uri].totalMessages - 1;
                if (existingMessages.length > 0 && existingMessages[existingMessages.length - 1].id === id) {
                    myContacts[uri].lastMessage = null;
                    myContacts[uri].lastMessageId = null;
                }
            }
            this.setState({messages: renderedMessages, myContacts: myContacts});
        }

        let idx = 'remove' + id;
        this.remove_sync_pending_item(idx);
    }

    async sendPendingMessage(uri, text, id) {
        utils.timestampedLog('Outgoing pending message', id);
        if (uri in this.state.myContacts && this.state.myContacts[uri].publicKey) {
            let public_keys = this.state.myContacts[uri].publicKey + "\n" + this.state.keys.public;
            await OpenPGP.encrypt(text, public_keys).then((encryptedMessage) => {
                //console.log('Outgoing encrypted message to', uri);
                this._sendMessage(uri, encryptedMessage, id);
            }).catch((error) => {
                console.log('Failed to encrypt message:', error);
            });
        } else {
            //console.log('Outgoing non-encrypted message to', uri);
            this._sendMessage(uri, text, id);
        }
    }

    async sendPendingMessages() {
        let query;
        let content;

        query = "SELECT * from messages where pending = 1 and content_type like 'text/%'";
        //console.log(query);
        await this.ExecuteQuery(query,[]).then((results) => {
            let rows = results.rows;
            for (let i = 0; i < rows.length; i++) {
                var item = rows.item(i);
                content = item.content;
                this.sendPendingMessage(item.to_uri, content, item.msg_id);
            }

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });

        query = "SELECT * FROM messages where direction = 'incoming' and system is null and received = 0";
        //console.log(query);

        await this.ExecuteQuery(query).then((results) => {
            //console.log('SQL get messages OK');

            let rows = results.rows;
            let imdn_msg;
            for (let i = 0; i < rows.length; i++) {
                var item = rows.item(i);
                let timestamp = JSON.parse(item.timestamp, _parseSQLDate);
                imdn_msg = {id: item.msg_id, timestamp: timestamp, from_uri: item.from_uri}
                if (this.sendDispositionNotification(imdn_msg, 'delivered')) {
                    query = "UPDATE messages set received = 1 where id = " + item.id;
                    //console.log(query);
                    this.ExecuteQuery(query).then((results) => {
                    }).catch((error) => {
                        console.log('SQL query:', query);
                        console.log('SQL error:', error);
                    });
                }
            }

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async updateRenderMessage(id, state) {
        let query;
        let uri;
        let changes = false;

        //console.log('updateRenderMessage', id, state);

        query = "SELECT * from messages where msg_id = '" + id + "';";
        //console.log(query);
        await this.ExecuteQuery(query,[]).then((results) => {
            let rows = results.rows;
            if (rows.length === 1) {
                var item = rows.item(0);
                uri = item.direction === 'outgoing' ? item.to_uri : item.from_uri;
                //console.log('Message uri', uri, 'new state', state);
                if (uri in this.state.messages) {
                    let renderedMessages = this.state.messages;

                    renderedMessages[uri].forEach((m) => {
                        if (m._id === id) {
                            if (state === 'accepted') {
                                m.pending = false;
                                changes = true;
                            }

                            if (state === 'delivered') {
                                m.sent = true;
                                m.pending = false;
                                changes = true;
                            }

                            if (state === 'displayed') {
                                m.received = true;
                                m.sent = true;
                                m.pending = false;
                                changes = true;
                            }

                            if (state === 'failed') {
                                m.received = false;
                                m.sent = false;
                                m.pending = false;
                                m.failed = true;
                                changes = true;
                            }

                            if (state === 'pinned') {
                                m.pinned = true;
                                changes = true;
                            }

                            if (state === 'unpinned') {
                                m.pinned = false;
                                changes = true;
                            }
                        }
                    });

                    if (changes) {
                        this.setState({messages: renderedMessages});
                    }
                }
            }

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async saveOutgoingChatUri(uri, content='') {
        //console.log('saveOutgoingChatUri', uri);
        let query;

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            myContacts[uri] = {};
        }

        myContacts[uri].unread = [];
        if (myContacts[uri].totalMessages) {
            myContacts[uri].totalMessages = myContacts[uri].totalMessages + 1;
        }

        if (content.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
            myContacts[uri].lastMessage = content.substring(0, 35);
        }
        myContacts[uri].lastMessageId = null;
        myContacts[uri].timestamp = new Date();

        this.saveSylkContact(uri, myContacts[uri]);
    }

     pinMessage(id) {
        let query;
        query = "UPDATE messages set pinned = 1 where msg_id ='" + id + "'";
        //console.log(query);
        this.ExecuteQuery(query).then((results) => {
            console.log('Message', id, 'pinned');
            this.updateRenderMessage(id, 'pinned')
            this.addJournal(id, 'pinMessage');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
     }

     unpinMessage(id) {
        let query;
        query = "UPDATE messages set pinned = 0 where msg_id ='" + id + "'";
        //console.log(query);
        this.ExecuteQuery(query).then((results) => {
            this.updateRenderMessage(id, 'unpinned')
            this.addJournal(id, 'unPinMessage');
            console.log('Message', id, 'unpinned');
        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
     }

     async addJournal(id, action, data={}) {
        //console.log('Add journal entry:', action, id);
        this.mySyncJournal[uuid.v4()] = {id: id, action: action, data: data};
        this.replayJournal();
     }

     async replayJournal() {
        if (!this.state.account) {
            utils.timestampedLog('Sync journal later when going online...');
            return;
        }

        let op;
        let executed_ops = [];

        Object.keys(this.mySyncJournal).forEach((key) => {
            executed_ops.push(key);
            op = this.mySyncJournal[key];
            utils.timestampedLog('Sync journal', op.action, op.id);
            if (op.action === 'removeConversation') {
                this.state.account.removeConversation(op.id, (error) => {
                    // TODO: add period and delete remote flags
                    if (!error) {
                        //utils.timestampedLog(op.action, op.id, 'journal operation was completed');
                        executed_ops.push(key);
                    } else {
                        utils.timestampedLog(op.action, op.id, 'journal operation failed:', error);
                    }
                });

            } else if (op.action === 'readConversation') {
                this.state.account.markConversationRead(op.id, (error) => {
                    if (!error) {
                        //utils.timestampedLog(op.action, op.id, 'journal operation completed');
                        executed_ops.push(key);
                    } else {
                        utils.timestampedLog(op.action, op.id, 'journal operation failed:', error);
                    }
                });

            } else if (op.action === 'removeMessage') {
                this.state.account.removeMessage({id: op.id, receiver: op.data.uri}, (error) => {
                    if (!error) {
                        //utils.timestampedLog(op.action, op.id, 'journal operation completed');
                        executed_ops.push(key);
                    } else {
                        utils.timestampedLog(op.action, op.id, 'journal operation failed:', error);
                    }
                });
            }
        });

        executed_ops.forEach((key) => {
            delete this.mySyncJournal[key];
        });

        storage.set('mySyncJournal', this.mySyncJournal);
        this.sendPendingMessages();
     }

     async confirmRead(uri){
        if (uri.indexOf('@') === -1) {
            return;
        }

        //console.log('Confirm read messages for', uri);
        let query;
        let displayed = [];

        query = "SELECT * FROM messages where from_uri = '" + uri + "' and received = 1 and system is NULL";
        //console.log(query);

        await this.ExecuteQuery(query).then((results) => {
            let rows = results.rows;
            if (rows.length > 0) {
               //console.log('We must confirm read of', rows.length, 'messages');
            }
            for (let i = 0; i < rows.length; i++) {
                var item = rows.item(i);
                if (this.sendDispositionNotification(item)) {
                    displayed.push(item.msg_id);
                }
            }

            if (displayed.length > 0) {
                let sql_ids = '';
                let i = 1;
                displayed.forEach((msg_id) => {
                    sql_ids = sql_ids + "'" + msg_id + "'";
                    if (i < displayed.length) {
                        sql_ids = sql_ids + ', ';
                    }
                    i = i + 1;
                });

                query = "UPDATE messages set received = 2 where msg_id in (" + sql_ids + ")";
                //console.log(query);
                this.ExecuteQuery(query).then((results) => {
                    //console.log('Sent disposition saved for', displayed.length, 'messages');
                }).catch((error) => {
                    console.log('SQL query:', query);
                    console.log('SQL error:', error);
                });
            }

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });

        this.resetUnreadCount(uri);
    }

    async resetUnreadCount(uri) {
        //console.log('Reset read count for', uri);
        let myContacts = this.state.myContacts;
        if (uri in myContacts) {
            if (myContacts[uri].unread.length > 0) {
                myContacts[uri].unread = [];
                this.setState({myContacts: myContacts});
                this.saveSylkContact(uri, myContacts[uri]);
                this.addJournal(uri, 'readConversation');
            }
        }
    }

    async sendDispositionNotification(message, state='displayed') {
        let query;
        let result = {};
        let id = message.msg_id || message.id;
        this.state.account.sendDispositionNotification(message.from_uri, id, message.timestamp, state,(error) => {
            if (!error) {
                utils.timestampedLog('Message', id, 'was', state, 'now');
                return true;
            } else {
                utils.timestampedLog(state, 'notification for message', id, 'send failed:', error);
                return false;
            }
        });

        return false;
    }

    loadEarlierMessages() {
        if (!this.state.selectedContact) {
            return;
        }

        let myContacts = this.state.myContacts;
        let uri = this.state.selectedContact.remoteParty;
        let limit = this.state.messageLimit * this.state.messageZoomFactor;

        if (myContacts[uri].totalMessages < limit) {
            //console.log('No more messages for', uri);
            return;
        }

        let messageZoomFactor = this.state.messageZoomFactor;
        messageZoomFactor = messageZoomFactor + 1;
        this.setState({messageZoomFactor: messageZoomFactor});

        setTimeout(() => {
            this.getMessages(this.state.selectedContact.remoteParty);
        }, 10);
    }

     async getMessages(uri){
        //console.log('Get messages with', uri, 'with zoom factor', this.state.messageZoomFactor);
        let messages = this.state.messages;
        let msg;
        let query;
        let rows = 0;
        let myContacts = this.state.myContacts;
        let total = 0;

        let limit = this.state.messageLimit * this.state.messageZoomFactor;

/*
        if (uri in myContacts && myContacts[uri].totalMessages) {
            //console.log(myContacts[uri].totalMessages, 'messages with', uri, 'from cache');
            total = myContacts[uri].totalMessages;
        } else {
*/
            query = "SELECT count(*) as rows FROM messages where from_uri = '"
                + uri
                + "' or to_uri = '"
                + uri
                + "';";

            await this.ExecuteQuery(query).then((results) => {
                rows = results.rows;
                total = rows.item(0).rows;
                //console.log(total, 'messages with', uri, 'from database');
            }).catch((error) => {
                console.log('SQL query:', query);
                console.log('SQL error:', error);
            });
//        }

        if (uri in myContacts) {
            myContacts[uri].totalMessages = total;
        }

        query = "SELECT * FROM messages where from_uri = '"
            + uri
            + "' or to_uri = '"
            + uri
            + "' order by id desc limit "
            + this.state.messageStart
            + " , "
            + limit
            + ";";

        //console.log(query);

        await this.ExecuteQuery(query).then((results) => {
            //console.log('SQL get messages OK');

            let rows = results.rows;
            messages[uri] = [];
            let content;
            let image;
            let ts;
            let last_message;
            let last_message_id;

            for (let i = 0; i < rows.length; i++) {
                var item = rows.item(i);
                content = item.content;
                let timestamp = JSON.parse(item.timestamp, _parseSQLDate);

                if (item.content_type === 'text/html') {
                    content = utils.html2text(content);
                } else if (item.content_type === 'text/plain') {
                    content = content;
                } else if (item.content_type.indexOf('image/') > -1) {
                    image = `data:${item.content_type};base64,${btoa(content)}`
                } else {
                    content = 'Unknown message type received ' + item.content_type;
                    continue;
                }

                let failed = (item.pending === 0 && item.received === 0 && item.sent === 1) ? true: false,

                msg = {
                    _id: item.msg_id,
                    text: content,
                    image: image,
                    createdAt: timestamp,
                    sent: ((item.sent === 1 || item.received === 1) && !failed) ? true : false,
                    direction: item.direction,
                    received: item.received === 1 ? true : false,
                    pending: (item.pending === 1 && item.sent !== 1) ? true : false,
                    system: item.system === 1 ? true : false,
                    failed: failed,
                    pinned: (item.pinned === 1) ? true: false,
                    user: item.direction == 'incoming' ? {_id: item.from_uri, name: item.from_name} : {}
                    }

                if (content.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
                    messages[uri].push(msg);
                }
            }

            messages[uri].sort((a, b) => (a.createdAt > b.createdAt) ? 1 : -1);

            if (messages[uri].length > 0) {
                console.log('Got', messages[uri].length, 'messages for', uri, 'from database');
                let last_item = messages[uri][messages[uri].length -1];
                if (!last_item.image && !last_item.system && last_item.text.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
                    last_message = last_item.text.substring(0, 35);
                    last_message_id = last_item.id;
                }
            }

            if (uri in myContacts) {
                if (last_message) {
                    myContacts[uri].lastMessage = last_message;
                    myContacts[uri].lastMessageId = last_message_id;
                    this.saveSylkContact(uri, myContacts[uri]);
                }
            }

            this.setState({messages: messages});

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
    }

    async deleteMessages(uri, local=true) {
        let query;

        //console.log('Purge messages for', uri);
        let myContacts = this.state.myContacts;

        if (uri) {
            if (local) {
                this.addJournal(uri, 'removeConversation');
                let conf_uri = uri;
                if (uri.indexOf('@') === -1) {
                    const conf_uri = uri + '@videoconference.' + this.state.defaultDomain;
                }
                this.deleteHistoryEntry(conf_uri);
            }

            query = "DELETE FROM messages where (from_uri = '"
                + uri
                + "' or to_uri = '"
                + uri
                + "')";

            await this.ExecuteQuery(query).then((result) => {
                this.removeContact(uri);

            }).catch((error) => {
                console.log('SQL query:', query);
                console.log('SQL error:', error);
            });
        } else {
            query = "DELETE FROM messages";
            console.log(query);
            await this.ExecuteQuery(query).then((result) => {
                Object.keys(myContacts).forEach((uri) => {
                    myContacts[uri].read = 0;
                    myContacts[uri].lastMessage = null;
                    myContacts[uri].lastMessageId = null;
                });

                this.setState({messages: {}, myContacts: myContacts});
                this.lastSyncedMessageId = null;
                storage.set('lastSyncedMessageId', null);

            }).catch((error) => {
                console.log('SQL query:', query);
                console.log('SQL error:', error);
            });
        }
    }


    playIncomingSound() {
        let must_play_sound = true;

        if (this.msg_sound_played_ts) {
            let diff = (Date.now() - this.msg_sound_played_ts)/ 1000;
            if (diff < 10) {
                must_play_sound = false;
            }
        }

        this.msg_sound_played_ts = Date.now();

        if (must_play_sound) {
            try {
              if (Platform.OS === 'ios') {
                  SoundPlayer.setSpeaker(true);
              }
              SoundPlayer.playSoundFile('message_received', 'wav');
            } catch (e) {
              console.log('Cannot play message_received.wav', e);
            }
        }
    }

    async removeMessage(message, uri=null) {
        if (uri === null) {
            uri = message.sender.uri;
        }

        await this.deleteMessage(message.id, uri, false).then((result) => {
            console.log('Message', message.id, 'to', uri, 'is removed');
        }).catch((error) => {
            //console.log('Failed to remove message', message.id, 'to', uri);
            return;
        });

        let renderMessages = this.state.messages;
        if (Object.keys(renderMessages).indexOf(uri) === -1) {
            return;
        }

        let existingMessages = renderMessages[uri];
        let newMessages = [];

        existingMessages.forEach((msg) => {
            if (msg.id === message.id) {
                return;
            }
            newMessages.push(msg);
        });

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            if (myContacts[uri].totalMessages) {
                myContacts[uri].totalMessages = myContacts[uri].totalMessages - 1;
            }

            let idx = myContacts[uri].unread.indexOf(message.id);

            if (idx > -1) {
                myContacts[uri].unread.splice(idx, 1);
            }

            if (myContacts[uri].lastMessageId === message.id) {
                myContacts[uri].lastMessage = null;
                myContacts[uri].lastMessageId = null;
            }
        }

        renderMessages[uri] = newMessages;
        this.setState({messages: renderMessages, myContacts: myContacts});
    }

    async removeConversation(obj) {
        let uri = obj;
        //console.log('removeConversation', uri);

        let renderMessages = this.state.messages;

        await this.deleteMessages(uri, false).then((result) => {
            utils.timestampedLog('Conversation with', uri, 'was removed');
        }).catch((error) => {
            console.log('Failed to delete conversation with', uri);
        });
    }

    removeConversationSync(obj) {
        let uri = obj.content;
        //console.log('Sync remove conversation with', uri);

        let query;

        if (uri.indexOf('@videoconference.') > -1) {
            uri = uri.split('@')[0];
        }

        query = "DELETE FROM messages where (from_uri = '"
            + uri
            + "' or to_uri = '"
            + uri
            + "')";

        this.ExecuteQuery(query).then((result) => {

        }).catch((error) => {
            console.log('SQL query:', query);
            console.log('SQL error:', error);
        });
        this.deleteSylkContact(uri);
    }

    async readConversation(obj) {
        let uri = obj;
        this.resetUnreadCount(uri)
    }

    removeContact(uri) {
        let myContacts = this.state.myContacts;
        this.deleteSylkContact(uri);

        let renderMessages = this.state.messages;

        if (uri in renderMessages) {
            delete renderMessages[uri];
            this.setState({messages: renderMessages});
        }
    }

    add_sync_pending_item(item) {
        if (this.sync_pending_items.indexOf(item) > -1) {
            return;
        }

        this.sync_pending_items.push(item);
        if (this.sync_pending_items.length == 1) {
            console.log('Sync started ---');
            this.setState({syncCoversations: true});

            if (this.syncTimer === null) {
                this.syncTimer = setTimeout(() => {
                    this.resetSyncTimer();
                }, 1000 * 60);
            }
        }
    }

    resetSyncTimer() {
        if (this.sync_pending_items.length > 0) {
            this.sync_pending_items = [];
            console.log('Sync ended ---');
            this.setState({syncCoversations: false});
        }
    }

    remove_sync_pending_item(item) {
        let idx = this.sync_pending_items.indexOf(item);
        if (idx > -1) {
            this.sync_pending_items.splice(idx, 1);
        }

        if (this.sync_pending_items.length == 0) {
            console.log('Sync ended ---');
            this.setState({syncCoversations: false});
            if (this.syncTimer !== null) {
                clearTimeout(this.syncTimer);
                this.syncTimer = null;
            }
        }
    }

    async syncConversations(messages) {
        if (this.sync_pending_items.length > 0) {
            console.log('Sync already in progress');
            return;
        }

        let myContacts = this.state.myContacts;
        let renderMessages = this.state.messages;
        console.log('Sync', messages.length, 'events from server');

        let i = 1;
        let idx;
        let uri;
        let content;
        let existingMessages;
        let formatted_date;
        let newMessages = [];
        let update_uris = {};
        let last_timestamp;
        let stats = {state: 0,
                     remove: 0,
                     incoming: 0,
                     outgoing: 0,
                     delete: 0,
                     read: 0}

        messages.forEach((message) => {
            last_timestamp = message.timestamp;
            i = i + 1;
            //console.log('Process journal', i, 'of', messages.length, message.contentType);

            if (message.contentType === 'application/sylk-message-remove') {
                uri = message.content.contact;
            } else if (message.contentType === 'application/sylk-conversation-remove') {
                uri = message.content;
            } else if (message.contentType === 'application/sylk-conversation-read' ) {
                uri = message.content;
            } else if (message.contentType === 'message/imdn') {
            } else {
                if (message.sender.uri === this.state.account.id) {
                    uri = message.receiver;
                } else {
                    uri = message.sender.uri;
                }
            }

            //console.log('Sync', message.timestamp, message.contentType, uri);

            if (message.contentType === 'application/sylk-message-remove') {
                idx = 'remove' + message.id;
                this.add_sync_pending_item(idx);

                if (Object.keys(myContacts).indexOf(uri) === -1) {
                    myContacts[uri] = this.newContact(uri);
                }

                this.deleteMessageSync(message.id, uri);

                if (uri in renderMessages) {
                    existingMessages = renderMessages[uri];
                    newMessages = [];

                    existingMessages.forEach((msg) => {
                        if (msg.id === message.id) {
                            return;
                        }
                        newMessages.push(msg);
                    });
                    renderMessages[uri] = newMessages;
                }

                if (myContacts[uri].totalMessages) {
                    myContacts[uri].totalMessages = myContacts[uri].totalMessages - 1;
                }

                let idx = myContacts[uri].unread.indexOf(message.id);

                if (idx > -1) {
                    myContacts[uri].unread.splice(idx, 1);
                }

                if (myContacts[uri].lastMessageId === message.id) {
                    myContacts[uri].lastMessage = null;
                    myContacts[uri].lastMessageId = null;
                }

                stats.delete = stats.delete + 1;

            } else if (message.contentType === 'application/sylk-conversation-remove') {
                if (uri in myContacts) {
                    delete myContacts[uri];
                }

                if (uri in update_uris) {
                    delete update_uris[uri];
                }

                if (uri in renderMessages) {
                    delete renderMessages[uri];
                }

                this.removeConversationSync(message);

                stats.remove = stats.remove + 1;

            } else if (message.contentType === 'application/sylk-conversation-read') {
                if (Object.keys(myContacts).indexOf(uri) === -1) {
                    myContacts[uri] = this.newContact(uri);
                }

                update_uris[uri] = last_timestamp;
                myContacts[uri].timestamp = new Date();
                stats.read = stats.read + 1;

            } else if (message.contentType === 'message/imdn') {
                this.messageStateChangedSync({messageId: message.id, state: message.state});
                stats.state = stats.state + 1;

            } else {
                this.add_sync_pending_item(message.id);

                if (message.sender.uri === this.state.account.id) {
                    if (message.contentType !== 'application/sylk-contact-update') {
                        update_uris[uri] = last_timestamp;
                        if (Object.keys(myContacts).indexOf(uri) === -1) {
                            myContacts[uri] = this.newContact(message.content);
                        }
                        myContacts[uri].timestamp = message.timestamp;
                    }
                    stats.outgoing = stats.outgoing + 1;
                    this.outgoingMessageSync(message);
                } else {
                    if (Object.keys(myContacts).indexOf(uri) === -1) {
                        myContacts[uri] = this.newContact(uri);
                    }
                    myContacts[uri].timestamp = message.timestamp;
                    if (message.dispositionNotification.indexOf('display') > -1) {
                        myContacts[uri].unread.push(message.id);
                        myContacts[uri].lastMessageId = message.id;
                    }

                    stats.incoming = stats.incoming + 1;
                    this.incomingMessageSync(message);
                }
            }

            this.lastSyncedMessageId = message.id;
        });

        /*
        if (messages.length > 0) {
            Object.keys(stats).forEach((key) => {
                console.log('Sync', stats[key], key);
            });
        }
        */

        this.setState({messages: renderMessages});

        // sync changed myContacts with SQL database
        Object.keys(update_uris).forEach((uri) => {
            if (uri !== this.state.accountId) {
                this.saveSylkContact(uri, myContacts[uri]);
            }
        });

        storage.set('lastSyncedMessageId', this.lastSyncedMessageId);
    }

    async incomingMessage(message) {
        utils.timestampedLog('Message', message.id, 'was received');
        // Handle incoming messages
        if (message.content.indexOf('?OTRv3') > -1) {
            return;
        }

        if (message.contentType === 'text/pgp-public-key') {
            this.savePublicKey(message.sender.uri, message.content);
            return;
        }

        if (message.contentType === 'text/pgp-private-key' && message.sender.uri === this.state.account.id) {
            console.log('Received PGP private key from another device');
            this.setState({showImportPrivateKeyModal: true,
                           privateKey: message.content});
            return;
        }

        const is_encrypted =  message.content.indexOf('-----BEGIN PGP MESSAGE-----') > -1 && message.content.indexOf('-----END PGP MESSAGE-----') > -1;

        if (is_encrypted) {
            if (!this.state.keys || !this.state.keys.private) {
                console.log('Missing private key, cannot decrypt message');
                this.saveSystemMessage(message.sender.uri, 'Cannot decrypt: no private key', 'incoming');
            } else {
                await OpenPGP.decrypt(message.content, this.state.keys.private).then((decryptedBody) => {
                    //console.log('Incoming message', message.id, 'decrypted');
                    this.handleIncomingMessage(message, decryptedBody);
                }).catch((error) => {
                    console.log('Failed to decrypt message:', error);
                    this.sendPublicKey(message.sender.uri);
                    //this.saveSystemMessage(message.sender.uri, 'Cannot decrypt: wrong public key', 'incoming');
                });
            }
        } else {
            //console.log('Incoming message is not encrypted');
            this.handleIncomingMessage(message, message.content, message.contentType);
        }

        this.lastSyncedMessageId = message.id;
        storage.set('lastSyncedMessageId', this.lastSyncedMessageId);
    }

    handleIncomingMessage(message, decryptedBody, contentType='text/plain') {
        let content = decryptedBody || message.content;

        this.saveIncomingMessage(message.sender.uri, message, content, contentType);

        let renderMessages = this.state.messages;
        if (Object.keys(renderMessages).indexOf(message.sender.uri) === -1) {
            renderMessages[message.sender.uri] = [];
        }

        renderMessages[message.sender.uri].push(utils.sylkToRenderMessage(message, decryptedBody));
        this.setState({messages: renderMessages});
    }

    async incomingMessageSync(message) {
        //console.log('Sync incoming message', message);
        // Handle incoming messages
        if (message.content.indexOf('?OTRv3') > -1) {
            this.remove_sync_pending_item(message.id);
            return;
        }

        if (message.contentType === 'text/pgp-public-key') {
            this.remove_sync_pending_item(message.id);
            this.savePublicKeySync(message.sender.uri, message.content);
            return;
        }

        if (message.contentType === 'text/pgp-private-key') {
            this.remove_sync_pending_item(message.id);
            return;
        }

        const is_encrypted =  message.content.indexOf('-----BEGIN PGP MESSAGE-----') > -1 && message.content.indexOf('-----END PGP MESSAGE-----') > -1;
        let content = message.content;

        if (is_encrypted) {
            if (!this.state.keys || !this.state.keys.private) {

            } else {
                await OpenPGP.decrypt(message.content, this.state.keys.private).then((decryptedBody) => {
                    //console.log('Incoming message', message.id, 'decrypted from', message.sender.uri);
                    //this.handleIncomingMessageSync(message, decryptedBody);
                    content = decryptedBody;
                    this.saveIncomingMessageSync(message.sender.uri, message, decryptedBody, message.contentType);
                }).catch((error) => {
                    this.remove_sync_pending_item(message.id);
                });
            }
        } else {
            console.log('Incoming message', message.id, 'not encrypted from', message.sender.uri);
            this.saveIncomingMessageSync(message.sender.uri, message, null, message.contentType);
        }

        this.remove_sync_pending_item(message.id);
    }

    async outgoingMessage(message) {
        utils.timestampedLog('Outgoing message', message.id, 'to', message.receiver);
        if (message.content.indexOf('?OTRv3') > -1) {
            return;
        }

        if (message.contentType === 'text/pgp-public-key') {
            return;
        }

        if (message.contentType === 'message/imdn') {
            return;
        }

        if (message.contentType === 'text/pgp-private-key' && message.sender.uri === this.state.account.id) {
            console.log('Received my own PGP private key');
            this.setState({showImportPrivateKeyModal: true,
                               privateKey: message.content});
            return;
        }

        const is_encrypted = message.content.indexOf('-----BEGIN PGP MESSAGE-----') > -1 && message.content.indexOf('-----END PGP MESSAGE-----') > -1;
        let content = message.content;

        if (is_encrypted) {
            await OpenPGP.decrypt(message.content, this.state.keys.private).then((decryptedBody) => {
                console.log('Outgoing message', message.id, 'decrypted to', message.receiver, message.contentType);
                if (message.contentType === 'application/sylk-contact-update') {
                    this.contactSync(decryptedBody);
                } else {
                    this.saveMessageSql(message, decryptedBody);
                    this.lastSyncedMessageId = message.id;
                    storage.set('lastSyncedMessageId', this.lastSyncedMessageId);

                    let myContacts = this.state.myContacts;
                    let uri = message.receiver;

                    if (uri in myContacts) {
                        //
                    } else {
                        myContacts[uri] = this.newContact(uri);
                    }

                    myContacts[uri].timestamp = new Date();

                    if (message.contentType === 'text/html') {
                        content = utils.html2text(content);
                    } else if (message.contentType.indexOf('image/') > -1) {
                        content = 'Image';
                    }

                    if (content && content.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
                        myContacts[uri].lastMessage = content.substring(0, 35);
                    }

                    this.saveSylkContact(uri, myContacts[uri]);
                }

            }).catch((error) => {
                console.log('Failed to decrypt my own message:', error);
                return;
            });
        } else {
            if (message.contentType === 'application/sylk-contact-update') {
                this.contactSync(content);
            } else {
                this.saveMessageSql(message);
                this.lastSyncedMessageId = message.id;
                storage.set('lastSyncedMessageId', this.lastSyncedMessageId);

                let myContacts = this.state.myContacts;
                let uri = message.receiver;

                if (uri in myContacts) {
                    //
                } else {
                    myContacts[uri] = this.newContact(uri);
                }

                myContacts[uri].timestamp = new Date();

                if (message.contentType === 'text/html') {
                    content = utils.html2text(content);
                } else if (message.contentType.indexOf('image/') > -1) {
                    content = 'Image';
                }

                if (content && content.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
                    myContacts[uri].lastMessage = content.substring(0, 35);
                }

                this.saveSylkContact(uri, myContacts[uri]);
            }
        }

    }

    async outgoingMessageSync(message) {
        //console.log('Sync outgoing message', message.id, 'to', message.receiver);
        if (message.content.indexOf('?OTRv3') > -1) {
            this.remove_sync_pending_item(message.id);
            return;
        }

        if (message.contentType === 'text/pgp-public-key') {
            this.remove_sync_pending_item(message.id);
            return;
        }

        if (message.contentType === 'message/imdn') {
            this.remove_sync_pending_item(message.id);
            return;
        }

        if (message.contentType === 'text/pgp-private-key') {
            this.remove_sync_pending_item(message.id);
            return;
        }

        const is_encrypted = message.content.indexOf('-----BEGIN PGP MESSAGE-----') > -1 && message.content.indexOf('-----END PGP MESSAGE-----') > -1;
        let content = message.content;

        if (is_encrypted) {
            await OpenPGP.decrypt(message.content, this.state.keys.private).then((decryptedBody) => {
                //console.log('Sync outgoing message', message.id, 'decrypted to', message.receiver);
                if (message.contentType === 'application/sylk-contact-update') {
                    this.contactSync(decryptedBody);
                    this.remove_sync_pending_item(message.id);
                } else {
                    this.saveMessageSql(message, decryptedBody);
                }
            }).catch((error) => {
                console.log('Failed to decrypt my own message:', error);
                this.remove_sync_pending_item(message.id);
                return;
            });
        } else {
            if (message.contentType === 'application/sylk-contact-update') {
                this.contactSync(content);
                this.remove_sync_pending_item(message.id);
            } else {
                this.saveMessageSql(message);
            }
        }
    }

    saveMessageSql(message, decryptedBody) {
        let pending = 0;
        let sent = 0;
        let received = null;
        let failed = 0;
        let content = decryptedBody || message.content;

        if (message.state == 'pending') {
            pending = 1;
        } else if (message.state == 'delivered') {
            sent = 1;
        } else if (message.state == 'displayed') {
            received = 1;
            sent = 1;
        } else if (message.state == 'failed') {
            sent = 1;
            received = 0;
            failed = 1;
        } else if (message.state == 'error') {
            sent = 1;
            received = 0;
            failed = 1;
        } else if (message.state == 'forbidden') {
            sent = 1;
            received = 0;
        }

        let params = [message.id, JSON.stringify(message.timestamp), content, message.contentType, message.sender.uri, message.receiver, "outgoing", pending, sent, received];
        this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, pending, sent, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            //console.log('SQL insert message OK');
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });

        this.remove_sync_pending_item(message.id);
    }

    async saveSystemMessage(uri, content, direction, missed=false) {
        let timestamp = new Date();
        let params = [uuid.v4(), JSON.stringify(timestamp), content, 'text/plain', direction === 'incoming' ? uri : this.state.account.id, direction === 'outgoing' ? uri : this.state.account.id, 0, 1, direction];
        await this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, pending, system, direction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            if (missed) {
                this.addUnreadMessage(uri);
            }
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    async saveIncomingMessage(uri, message, decryptedBody=null, contentType='text/plain') {
        var content = decryptedBody || message.content;
        let received = 1;
        let params = [message.id, JSON.stringify(message.timestamp), content, message.contentType, message.sender.uri, this.state.account.id, "incoming", received];
        await this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
            this.addUnreadMessage(uri, message.sender.toString(), content, contentType, message.id);
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    saveIncomingMessageSync(uri, message, decryptedBody=null, contentType='text/plain') {
        var content = decryptedBody || message.content;
        let received = 0;
        let imdn_msg;
        if (message.dispositionNotification.indexOf('positive-delivery') > -1) {
            imdn_msg = {id: message.id, timestamp: message.timestamp, from_uri: message.sender.uri}
            if (this.sendDispositionNotification(imdn_msg, 'delivered')) {
                received = 1;
            }
        } else {
            //console.log('Incoming message', message.id, 'was already delivered');
            received = 1;
        }

        if (message.dispositionNotification.indexOf('display') === -1) {
            //console.log('Incoming message', message.id, 'was already read');
            received = 2;
        }

        let params = [message.id, JSON.stringify(message.timestamp), content, message.contentType, message.sender.uri, this.state.account.id, "incoming", received];
        this.ExecuteQuery("INSERT INTO messages (msg_id, timestamp, content, content_type, from_uri, to_uri, direction, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params).then((result) => {
        }).catch((error) => {
            if (error.message.indexOf('UNIQUE constraint failed') === -1) {
                console.log('SQL error:', error);
            }
        });
    }

    async addUnreadMessage(uri, name='', content='', contentType='text/html', id=null) {
        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            myContacts[uri] = this.newContact(uri)
            myContacts[uri].name = name;
        }

        myContacts[uri].unread.push(id);
        myContacts[uri].timestamp = new Date();

        if (myContacts[uri].totalMessages) {
            myContacts[uri].totalMessages = myContacts[uri].totalMessages + 1;
        }

        if (contentType === 'text/html') {
            content = utils.html2text(content);
        } else if (contentType.indexOf('image/') > -1) {
            content = 'Image';
        }

        if (content && content.indexOf('-----BEGIN PGP MESSAGE-----') === -1) {
            myContacts[uri].lastMessage = content.substring(0, 35);
            if (id) {
                myContacts[uri].lastMessageId = id;
            }
        }

        this.saveSylkContact(uri, myContacts[uri]);
    }

    saveParticipant(callUUID, room, uri) {
        if (this._historyConferenceParticipants.has(callUUID)) {
            let old_participants = this._historyConferenceParticipants.get(callUUID);
            if (old_participants.indexOf(uri) === -1) {
                old_participants.push(uri);
            }

        } else {
            let new_participants = [uri];
            this._historyConferenceParticipants.set(callUUID, new_participants);
        }

        if (!this.myParticipants) {
            this.myParticipants = new Object();
        }

        if (this.myParticipants.hasOwnProperty(room)) {
            let old_uris = this.myParticipants[room];
            if (old_uris.indexOf(uri) === -1 && uri !== this.state.account.id && (uri + '@' + this.state.defaultDomain) !== this.state.account.id) {
                this.myParticipants[room].push(uri);
            }

        } else {
            let new_uris = [];
            if (uri !== this.state.account.id && (uri + '@' + this.state.defaultDomain) !== this.state.account.id) {
                new_uris.push(uri);
            }

            if (new_uris) {
                this.myParticipants[room] = new_uris;
            }
        }

        storage.set('myParticipants', this.myParticipants);
    }

    deleteContact(uri) {
        uri = uri.trim().toLowerCase();

        if (uri.indexOf('@') === -1) {
            uri = uri + '@' + this.state.defaultDomain;
        }

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            this.deleteMessages(uri);
        }
        this.setState({selectedContact: null, target_uri: ''});
    }

    deletePublicKey(uri) {
        uri = uri.trim().toLowerCase();

        if (uri.indexOf('@') === -1) {
            uri = uri + '@' + this.state.defaultDomain;
        }

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            myContacts[uri].publicKey = null;
            console.log('Public key of', uri, 'deleted');
            this.saveSylkContact(uri, myContacts[uri]);
        }
    }

    newContact(uri) {
        let current_datetime = new Date();
        let formatted_date = current_datetime.getFullYear() + "-" + utils.appendLeadingZeroes(current_datetime.getMonth() + 1) + "-" + utils.appendLeadingZeroes(current_datetime.getDate()) + " " + utils.appendLeadingZeroes(current_datetime.getHours()) + ":" + utils.appendLeadingZeroes(current_datetime.getMinutes()) + ":" + utils.appendLeadingZeroes(current_datetime.getSeconds());
        const contact = { uri: uri,
                          name: '',
                          organization: '',
                          favorite: false,
                          blocked: false,
                          unread: [],
                          tags: [],
                          participants: [],
                          publicKey: null,
                          lastMessageId: null,
                          timestamp: formatted_date,
                          lastMessage: null
                          }
        return contact;
    }

    saveContact(uri, displayName, organization='') {
        displayName = displayName.trim();
        uri = uri.trim().toLowerCase();

        if (uri.indexOf('@') === -1) {
            uri = uri + '@' + this.state.defaultDomain;
        }

        console.log('Save contact', displayName, 'with uri', uri, 'and organization', organization);

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri].organization = organization;
        myContacts[uri].name = displayName;
        myContacts[uri].uri = uri;
        myContacts[uri].timestamp = new Date();

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        this.replicateContact(myContacts[uri]);

        this.saveSylkContact(uri, myContacts[uri]);

        let selectedContact = this.state.selectedContact;
        if (selectedContact && selectedContact.remoteParty === uri) {
            selectedContact.displayName = displayName;
            selectedContact.organization = organization;
            this.setState({selectedContact: selectedContact});
        }

        if (uri === this.state.accountId) {
            storage.set('displayName', displayName);
            storage.set('organization', organization);
            this.setState({displayName: displayName, organization: organization});
            if (this.state.account && displayName !== this.state.account.displayName) {
                this.processRegistration(this.state.accountId, this.state.password, displayName);
            }
        }
    }

    async replicateContact(contact) {
        //console.log('Replicate contact', contact);

        let id = uuid.v4();
        let content;
        let contentType = 'application/sylk-contact-update';
        let new_contact = {}

        new_contact.uri = contact.uri;
        new_contact.name = contact.name;
        new_contact.organization = contact.organization;
        new_contact.blocked = contact.blocked;
        new_contact.favorite = contact.favorite;
        new_contact.timestamp = Math.floor(contact.timestamp / 1000);
        new_contact.tags = contact.tags;
        new_contact.participants = contact.participants;

        content = JSON.stringify(new_contact);

        this.saveOutgoingRawMessage(id, this.state.accountId, this.state.accountId, content, contentType);

        await OpenPGP.encrypt(content, this.state.keys.public).then((encryptedMessage) => {
            this._sendMessage(this.state.accountId, encryptedMessage, id, contentType);
        }).catch((error) => {
            console.log('Failed to encrypt contact:', error);
        });
    }

    contactSync(json_contact) {
        let contact;
        contact = JSON.parse(json_contact);

        if (contact.uri === null) {
            return;
        }

        if (contact.uri === this.state.accountId) {
            storage.set('displayName', contact.name);
            storage.set('organization', contact.organization);
            this.setState({displayName: contact.name, organization: contact.organization});
        }

        let uri = contact.uri;
        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            //
        } else {
            if (contact.uri === this.state.accountId) {
                return;
            }

            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri].uri = uri;
        myContacts[uri].name = contact.name;
        myContacts[uri].organization = contact.organization;
        myContacts[uri].timestamp = new Date(contact.timestamp * 1000);
        myContacts[uri].tags = contact.tags;
        myContacts[uri].participants = contact.participants;

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        this.saveSylkContact(uri, myContacts[uri]);

        this.updateFavorite(uri, contact.favorite);
        this.updateBlocked(uri, contact.blocked);

    }

    sanitizeContact(uri, contact) {
        //console.log('sanitizeContact', uri, contact);

        let idx;
        contact.uri = uri;

        if (!contact.favorite) {
            contact.favorite = false;
        }

        if (!contact.blocked) {
            contact.blocked = false;
        }

        if (!contact.tags) {
            contact.tags = [];
        }

        if (!contact.participants) {
            contact.participants = [];
        }

        if (!contact.unread) {
            contact.unread = [];
        }

        idx = contact.tags.indexOf('favorite');
        if (idx > -1 && !contact.favorite) {
             contact.tags.splice(idx, 1);
        } else if (contact.favorite && idx === -1){
            contact.tags.push('favorite');
        }

        if (idx > -1) {
            contact.favorite = true;
        }

        idx = contact.tags.indexOf('blocked');
        if (idx > -1 && !contact.blocked) {
             contact.tags.splice(idx, 1);
        } else if (contact.blocked && idx === -1){
            contact.tags.push('blocked');
        }

        if (idx > -1) {
            contact.blocked = true;
        }

        return contact;
    }

    updateFavorite(uri, favorite) {
        if (favorite === null) {
            return;
        }

        let favoriteUris = this.state.favoriteUris;
        let myContacts = this.state.myContacts;
        let idx;

        idx = favoriteUris.indexOf(uri);
        if (favorite && idx === -1) {
            favoriteUris.push(uri);
            console.log(uri, 'is favorite');
        } else if (!favorite && idx > -1) {
            favoriteUris.splice(idx, 1);
            console.log(uri, 'is not favorite');
        } else {
            return;
        }

        if (uri in myContacts) {
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        myContacts[uri].favorite = favorite;

        idx = myContacts[uri].tags.indexOf('favorite');
        if (idx > -1) {
            myContacts[uri].tags.splice(idx, 1);
        } else {
            myContacts[uri].tags.push('favorite');
        }

        this.saveSylkContact(uri, myContacts[uri]);
        this.setState({favoriteUris: favoriteUris, refreshFavorites: !this.state.refreshFavorites});
    }

    toggleFavorite(uri) {
        //console.log('toggleFavorite', uri);
        let favoriteUris = this.state.favoriteUris;
        let myContacts = this.state.myContacts;
        let selectedContact;
        let favorite;

        if (uri in myContacts) {
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        myContacts[uri].favorite = !myContacts[uri].favorite

        idx = myContacts[uri].tags.indexOf('favorite');
        if (idx > -1) {
             myContacts[uri].tags.splice(idx, 1);
        } else {
            myContacts[uri].tags.push('favorite');
        }

        myContacts[uri].timestamp = new Date();

        this.saveSylkContact(uri, myContacts[uri]);

        let idx = favoriteUris.indexOf(uri);
        if (idx === -1) {
            favoriteUris.push(uri);
            favorite = true;
            console.log(uri, 'is favorite');
        } else {
            let removed = favoriteUris.splice(idx, 1);
            favorite = false;
            console.log(uri, 'is not favorite');
        }

        this.replicateContact(myContacts[uri]);
        this.setState({favoriteUris: favoriteUris, refreshFavorites: !this.state.refreshFavorites});

        return favorite;
    }

    toggleBlocked(uri) {
        let blockedUris = this.state.blockedUris;
        let myContacts = this.state.myContacts;

        let blocked;

        if (uri in myContacts) {
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        myContacts[uri].blocked = !myContacts[uri].blocked;
        myContacts[uri].timestamp = new Date();

        this.saveSylkContact(uri, myContacts[uri]);

        let idx = blockedUris.indexOf(uri);
        if (idx === -1) {
            blockedUris.push(uri);
            blocked = true;
            console.log(uri, 'is blocked');
        } else {
            blockedUris.splice(idx, 1);
            blocked = false;
            console.log(uri, 'is not blocked');
        }

        this.setState({blockedUris: blockedUris, selectedContact: null});

        this.replicateContact(myContacts[uri]);

        return blocked;
    }

    updateBlocked(uri, blocked) {
        if (blocked === null) {
            return;
        }

        let blockedUris = this.state.blockedUris;
        let myContacts = this.state.myContacts;
        let idx;

        idx = blockedUris.indexOf(uri);
        if (blocked && idx === -1) {
            blockedUris.push(uri);
            console.log(uri, 'is blocked');
        } else if (!blocked && idx > -1) {
            blockedUris.splice(idx, 1);
            console.log(uri, 'is not blocked');
        } else {
            return;
        }

        this.setState({blockedUris: blockedUris});

        if (uri in myContacts) {
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri] = this.sanitizeContact(uri, myContacts[uri]);

        myContacts[uri].blocked = blocked;

        idx = myContacts[uri].tags.indexOf('blocked');
        if (idx > -1) {
            myContacts[uri].tags.splice(idx, 1);
        } else {
            myContacts[uri].tags.push('blocked');
        }

        this.saveSylkContact(uri, myContacts[uri]);
    }

    appendInvitedParties(room, uris) {
        room = room.split('@')[0];
        //console.log('Save invited parties', uris, 'for room', room);
        let myInvitedParties = this.state.myInvitedParties;

        let current_uris = myInvitedParties.hasOwnProperty(room) ? myInvitedParties[room] : [];
        uris.forEach((uri) => {
            let idx = current_uris.indexOf(uri);
            if (idx === -1) {
                if (uri.indexOf('@') === -1) {
                    uri =  uri + '@' + this.state.defaultDomain;
                }

                if (uri !== this.state.account.id) {
                    current_uris.push(uri);
                    console.log('Added', uri, 'to room', room);
                }
            }
        });

        this.saveInvitedParties(room, uris);
    }

    saveInvitedParties(room, uris) {
        let uri = room;
        room = room.split('@')[0];
        //console.log('Save invited parties', uris, 'for room', room);

        let myInvitedParties = this.state.myInvitedParties;

        let new_uris = [];
        uris.forEach((uri) => {
            if (uri.indexOf('@') === -1) {
                uri =  uri + '@' + this.state.defaultDomain;
            }
            if (uri !== this.state.account.id) {
                new_uris.push(uri);
                console.log('Added', uri, 'to room', room);
            }
        });

        let myContacts = this.state.myContacts;

        if (uri in myContacts) {
            myContacts[uri].timestamp = new Date();
        } else {
            myContacts[uri] = this.newContact(uri);
        }

        myContacts[uri].participants = new_uris;
        this.replicateContact(myContacts[uri]);
        this.saveSylkContact(uri, myContacts[uri]);
    }

    deleteHistoryEntry(uri) {
        let history = this.state.localHistory;
        for (var i = history.length - 1; i >= 0; --i) {
            if (history[i].remoteParty === uri) {
                history.splice(i,1);
            }
        }
        storage.set('history', history);
        this.setState({localHistory: history});
    }

    addConferenceHistoryEntry(uri, callUUID, direction='placed', participants=[]) {
        let current_datetime = new Date();
        let startTime = current_datetime.getFullYear() + "-" + utils.appendLeadingZeroes(current_datetime.getMonth() + 1) + "-" + utils.appendLeadingZeroes(current_datetime.getDate()) + " " + utils.appendLeadingZeroes(current_datetime.getHours()) + ":" + utils.appendLeadingZeroes(current_datetime.getMinutes()) + ":" + utils.appendLeadingZeroes(current_datetime.getSeconds());

        let item = {
                    remoteParty: uri,
                    direction: direction,
                    type: 'history',
                    conference: true,
                    participants: participants,
                    media: ['audio', 'video'],
                    displayName: uri.split('@')[0],
                    sessionId: callUUID,
                    startTime: startTime,
                    stopTime: startTime,
                    startTimeObject: current_datetime,
                    duration: 0,
                    tags: ['history', 'local']
                    };

        const historyItem = Object.assign({}, item);
        let newHistory = this.state.localHistory;
        newHistory.push(historyItem);
        this.setState({localHistory: newHistory});
        storage.set('history', newHistory);
    }

    render() {
        let footerBox = <View style={styles.footer}><FooterBox /></View>;

        let extraStyles = {};

        if (this.state.localMedia || this.state.registrationState === 'registered') {
           footerBox = null;
        }

        let loadingLabel = this.state.loading;
        if (this.state.syncCoversations) {
            loadingLabel = 'Sync conversations';
        }

        return (
            <PaperProvider theme={theme}>
                <Router history={history} ref="router">
                    <ImageBackground source={backgroundImage} style={{width: '100%', height: '100%'}}>
                                <View style={mainStyle.MainContainer} onLayout={(event) => this.setState({
                                                                        Width_Layout : event.nativeEvent.layout.width,
                                                                        Height_Layout : event.nativeEvent.layout.height
                                                                        }, ()=> this._detectOrientation())}>
                        <SafeAreaView style={[styles.root, extraStyles]}>
                            <IncomingCallModal
                                call={this.state.incomingCall}
                                onAccept={this.callKeepAcceptCall}
                                onReject={this.callKeepRejectCall}
                                show={this.state.showIncomingModal}
                                contacts = {this.contacts}
                            />

                            <LogsModal
                                logs={this.state.logs}
                                show={this.state.showLogsModal}
                                refresh={this.showLogs}
                                close={this.hideLogsModal}
                                purgeLogs={this.purgeLogs}
                                orientation={this.state.orientation}
                            />

                            <LoadingScreen
                            text={loadingLabel}
                            show={this.state.loading !== null || this.state.syncCoversations}
                            orientation={this.state.orientation}
                            isTablet={this.state.isTablet}
                            />
                            <Switch>
                                <Route exact path="/" component={this.main} />
                                <Route exact path="/login" component={this.login} />
                                <Route exact path="/logout" component={this.logout} />
                                <Route exact path="/ready" component={this.ready} />
                                <Route exact path="/call" component={this.call} />
                                <Route exact path="/conference" component={this.conference} />
                                <Route exact path="/preview" component={this.preview} />
                                <Route component={this.notFound} />
                            </Switch>

                            <NotificationCenter ref="notificationCenter" />

                        </SafeAreaView>
                        </View>
                    </ImageBackground>
                </Router>
            </PaperProvider>
        );
    }

    notFound(match) {

        const status = {
            title   : '404',
            message : 'Oops, the page your looking for can\'t found',
            level   : 'danger',
            width   : 'large'
        }
        return (
            <StatusBox
                {...status}
            />
        );
    }

    saveHistoryForLater(history) {
        //console.log('Cache history for later', history.length)
        this.cachedHistory = history;
        storage.set('cachedHistory', history);
    }

    hideLogsModal() {
       this.setState({showLogsModal: false});
    }

    purgeLogs() {
        RNFS.unlink(logfile)
          .then(() => {
            utils.timestampedLog('Log file initialized');
            this.showLogs();
          })
          // `unlink` will throw an error, if the item to unlink does not exist
          .catch((err) => {
            console.log(err.message);
          });
    }

    showLogs() {
       this.setState({showLogsModal: true});
       RNFS.readFile(logfile, 'utf8').then((content) => {
           console.log('Read', content.length, 'bytes from', logfile);
           const lastlines = content.split('\n').slice(-MAX_LOG_LINES).join('\n');
           this.setState({logs: lastlines});
       });
    }

    trimLogs() {
       RNFS.readFile(logfile, 'utf8').then((content) => {
           const lines = content.split('\n');
           //console.log('Read', lines.length, 'lines and', content.length, 'bytes from', logfile);
           if (lines.length > (MAX_LOG_LINES + 50) || content.length > 100000) {
               const text = lines.slice(-MAX_LOG_LINES).join('\n');
               RNFS.writeFile(logfile, text + '\r\n', 'utf8')
                   .then((success) => {
                   //console.log('Trimmed logs to', MAX_LOG_LINES, 'lines and', text.length, 'bytes');
               })
               .catch((err) => {
                   console.log(err.message);
               });
           }
       });
    }

    ready() {
        let publicKey;
        let call = this.state.currentCall || this.state.incomingCall;

        if (this.state.selectedContact) {
            const uri = this.state.selectedContact.remoteParty;
            if (uri in this.state.myContacts && this.state.myContacts[uri].publicKey) {
                publicKey = this.state.myContacts[uri].publicKey;
            }
        } else {
            publicKey = this.state.keys ? this.state.keys.public: null;
        }

        return (
            <Fragment>
                <NavigationBar
                    notificationCenter = {this.notificationCenter}
                    account = {this.state.account}
                    accountId = {this.state.accountId}
                    logout = {this.logout}
                    inCall = {(this.state.incomingCall || this.state.currentCall) ? true: false}
                    toggleSpeakerPhone = {this.toggleSpeakerPhone}
                    toggleProximity = {this.toggleProximity}
                    proximity = {this.state.proximityEnabled}
                    preview = {this.startPreview}
                    showLogs = {this.showLogs}
                    goBackFunc = {this.goBackToHome}
                    connection = {this.state.connection}
                    registrationState = {this.state.registrationState}
                    orientation = {this.state.orientation}
                    isTablet = {this.state.isTablet}
                    displayName = {this.state.displayName}
                    organization = {this.state.organization}
                    selectedContact = {this.state.selectedContact}
                    messages = {this.state.messages}
                    replicateKey = {this.replicatePrivateKey}
                    publicKey = {publicKey}
                    deleteMessages = {this.deleteMessages}
                    toggleFavorite = {this.toggleFavorite}
                    toggleBlocked = {this.toggleBlocked}
                    togglePinned = {this.togglePinned}
                    myInvitedParties={this.state.myInvitedParties}
                    saveInvitedParties={this.saveInvitedParties}
                    defaultDomain = {this.state.defaultDomain}
                    favoriteUris = {this.state.favoriteUris}
                    startCall = {this.callKeepStartCall}
                    saveContact = {this.saveContact}
                    deleteContact = {this.deleteContact}
                    sendPublicKey = {this.sendPublicKey}
                    deletePublicKey = {this.deletePublicKey}
                    showImportModal = {this.toggleImportPrivateKeyModal}

                />
                <ReadyBox
                    account = {this.state.account}
                    password = {this.state.password}
                    config = {config}
                    inCall = {(this.state.incomingCall || this.state.currentCall) ? true: false}
                    startCall = {this.callKeepStartCall}
                    startConference = {this.callKeepStartConference}
                    missedTargetUri = {this.state.missedTargetUri}
                    orientation = {this.state.orientation}
                    contacts = {this.contacts}
                    isTablet = {this.state.isTablet}
                    isLandscape = {this.state.orientation === 'landscape'}
                    refreshHistory = {this.state.refreshHistory}
                    refreshFavorites = {this.state.refreshFavorites}
                    cacheHistory = {this.saveHistoryForLater}
                    localHistory = {this.state.localHistory}
                    serverHistory = {this.cachedHistory}
                    myDisplayName = {this.state.displayName}
                    myPhoneNumber = {this.state.myPhoneNumber}
                    deleteHistoryEntry = {this.deleteHistoryEntry}
                    saveInvitedParties = {this.saveInvitedParties}
                    myInvitedParties = {this.state.myInvitedParties}
                    toggleFavorite = {this.toggleFavorite}
                    toggleBlocked = {this.toggleBlocked}
                    favoriteUris = {this.state.favoriteUris}
                    blockedUris = {this.state.blockedUris}
                    defaultDomain = {this.state.defaultDomain}
                    saveContact = {this.saveContact}
                    myContacts = {this.state.myContacts}
                    lookupContacts = {this.lookupContacts}
                    confirmRead = {this.confirmRead}
                    selectedContact = {this.state.selectedContact}
                    call = {this.state.incomingCall || this.state.currentCall}
                    goBackFunc = {this.goBackToCall}
                    messages = {this.state.messages}
                    deleteMessages = {this.deleteMessages}
                    sendMessage = {this.sendMessage}
                    expireMessage = {this.expireMessage}
                    reSendMessage = {this.reSendMessage}
                    deleteMessage = {this.deleteMessage}
                    getMessages = {this.getMessages}
                    pinMessage = {this.pinMessage}
                    unpinMessage = {this.unpinMessage}
                    selectContact = {this.selectContact}
                    sendPublicKey = {this.sendPublicKey}
                    inviteContacts = {this.state.inviteContacts}
                    selectedContacts = {this.state.selectedContacts}
                    updateSelection = {this.updateSelection}
                    togglePinned = {this.togglePinned}
                    pinned = {this.state.pinned}
                    loadEarlierMessages = {this.loadEarlierMessages}
                />

                <ImportPrivateKeyModal
                    show={this.state.showImportPrivateKeyModal}
                    close={this.toggleImportPrivateKeyModal}
                    saveFunc={this.syncPrivateKeys}
                    generateKeysFunc={this.generateKeys}
                    privateKey={this.state.privateKey}
                    status={this.state.privateKeyImportStatus}
                    success={this.state.privateKeyImportSuccess}
                />
            </Fragment>
        );
    }

    preview() {
        return (
            <Fragment>
                <Preview
                    localMedia = {this.state.localMedia}
                    hangupCall = {this.hangupCall}
                    setDevice = {this.setDevice}
                    selectedDevices = {this.state.devices}
                />
            </Fragment>
        );
    }

    call() {
        let call = this.state.currentCall || this.state.incomingCall;
        let callState;

        if (call && call.id in this.state.callsState) {
            callState = this.state.callsState[call.id];
        }

        return (
            <Call
                account = {this.state.account}
                targetUri = {this.state.targetUri}
                call = {call}
                callState = {callState}
                connection = {this.state.connection}
                registrationState = {this.state.registrationState}
                localMedia = {this.state.localMedia}
                escalateToConference = {this.escalateToConference}
                hangupCall = {this.hangupCall}
                showLogs = {this.showLogs}
                generatedVideoTrack = {this.state.generatedVideoTrack}
                callKeepSendDtmf = {this.callKeepSendDtmf}
                toggleMute = {this.toggleMute}
                callKeepStartCall = {this.callKeepStartCall}
                toggleSpeakerPhone = {this.toggleSpeakerPhone}
                speakerPhoneEnabled = {this.state.speakerPhoneEnabled}
                speakerphoneOn = {this.speakerphoneOn}
                speakerphoneOff = {this.speakerphoneOff}
                callUUID = {this.state.outgoingCallUUID}
                contacts = {this.contacts}
                intercomDtmfTone = {this.intercomDtmfTone}
                orientation = {this.state.orientation}
                isTablet = {this.state.isTablet}
                reconnectingCall = {this.state.reconnectingCall}
                muted = {this.state.muted}
                myContacts = {this.state.myContacts}
                declineReason = {this.state.declineReason}
                goBackFunc={this.goBackToHomeFromCall}
                messages = {this.state.messages}
                sendMessage={this.sendMessage}
                reSendMessage={this.reSendMessage}
                expireMessage = {this.expireMessage}
                deleteMessage = {this.deleteMessage}
                getMessages = {this.getMessages}
                pinMessage = {this.pinMessage}
                unpinMessage = {this.unpinMessage}
                confirmRead = {this.confirmRead}
                selectedContact={this.state.selectedContact}
            />
        )
    }

    conference() {
        let _previousParticipants = new Set();

        let call = this.state.currentCall || this.state.incomingCall;
        let callState;

        if (call && call.id in this.state.callsState) {
            callState = this.state.callsState[call.id];
        }

        /*
        if (this.myParticipants) {
            let room = this.state.targetUri.split('@')[0];
            if (this.myParticipants.hasOwnProperty(room)) {
                let uris = this.myParticipants[room];
                if (uris) {
                    uris.forEach((uri) => {
                        if (uri.search(this.state.defaultDomain) > -1) {
                            let user = uri.split('@')[0];
                            _previousParticipants.add(user);
                        } else {
                            _previousParticipants.add(uri);
                        }
                    });
                }
            }
        }
        */

        if (this.state.myInvitedParties) {
            let room = this.state.targetUri.split('@')[0];
            if (this.state.myInvitedParties.hasOwnProperty(room)) {
                let uris = this.state.myInvitedParties[room];
                if (uris) {
                    uris.forEach((uri) => {
                        _previousParticipants.add(uri);
                    });
                }
            }
        }

        let previousParticipants = Array.from(_previousParticipants);

        return (
            <Conference
                notificationCenter = {this.notificationCenter}
                localMedia = {this.state.localMedia}
                account = {this.state.account}
                targetUri = {this.state.targetUri}
                connection = {this.state.connection}
                registrationState = {this.state.registrationState}
                currentCall = {this.state.currentCall}
                saveParticipant = {this.saveParticipant}
                saveMessage = {this.saveConferenceMessage}
                myInvitedParties = {this.state.myInvitedParties}
                saveInvitedParties = {this.appendInvitedParties}
                previousParticipants = {previousParticipants}
                participantsToInvite = {this.state.participantsToInvite}
                hangupCall = {this.hangupCall}
                shareScreen = {this.switchScreensharing}
                generatedVideoTrack = {this.state.generatedVideoTrack}
                toggleMute = {this.toggleMute}
                toggleSpeakerPhone = {this.toggleSpeakerPhone}
                speakerPhoneEnabled = {this.state.speakerPhoneEnabled}
                callUUID = {this.state.outgoingCallUUID}
                proposedMedia = {this.outgoingMedia}
                isLandscape = {this.state.orientation === 'landscape'}
                isTablet = {this.state.isTablet}
                muted = {this.state.muted}
                defaultDomain = {this.state.defaultDomain}
                startedByPush = {this.startedByPush}
                inFocus = {this.state.inFocus}
                reconnectingCall = {this.state.reconnectingCall}
                toggleFavorite = {this.toggleFavorite}
                favoriteUris = {this.state.favoriteUris}
                myContacts = {this.state.myContacts}
                lookupContacts={this.lookupContacts}
                goBackFunc={this.goBackToHome}
                inviteToConferenceFunc={this.inviteContactsToConference}
                selectedContacts={this.state.selectedContacts}
                callState={callState}
            />
        )
    }

    matchContact(contact, filter='', matchDisplayName=true) {
        if (contact.remoteParty.toLowerCase().startsWith(filter.toLowerCase())) {
            return true;
        }

        if (matchDisplayName && contact.displayName && contact.displayName.toLowerCase().indexOf(filter.toLowerCase()) > -1) {
            return true;
        }

        return false;
    }

    lookupContacts(text, addressbook=true, favorites=true, localHistory=true, serverHistory=true) {
        let contacts = [];

        if (addressbook) {
            const addressbook_contacts = this.contacts.filter(contact => this.matchContact(contact, text));
            addressbook_contacts.forEach((c) => {
                const existing_contacts = contacts.filter(contact => this.matchContact(contact, c.remoteParty.toLowerCase(), false));
                if (existing_contacts.length === 0) {
                    contacts.push(c);
                }
            });
        }

        if (favorites) {
            const favorite_contacts = this.favoritesContacts.filter(contact => this.matchContact(contact, text));
            favorite_contacts.forEach((c) => {
                const existing_contacts = contacts.filter(contact => this.matchContact(contact, c.remoteParty.toLowerCase(), false));
                if (existing_contacts.length === 0) {
                    contacts.push(c);
                }
            });
        }

        if (localHistory) {
            const local_history_contacts = this.state.localHistory.filter(contact => this.matchContact(contact, text));
            local_history_contacts.forEach((c) => {
                const existing_contacts = contacts.filter(contact => this.matchContact(contact, c.remoteParty.toLowerCase(), false));
                if (c.remoteParty.toLowerCase().indexOf('@guest.')) {
                }
                if (c.remoteParty.toLowerCase().indexOf('@conference.')) {
                }
                if (c.remoteParty.toLowerCase().indexOf('@videoconference.')) {
                }
                if (existing_contacts.length === 0) {
                    contacts.push(c);
                }
            });
        }

        if (serverHistory) {
            const server_history_contacts = this.cachedHistory.filter(contact => this.matchContact(contact, text));
            server_history_contacts.forEach((c) => {
                const existing_contacts = contacts.filter(contact => this.matchContact(contact, c.remoteParty.toLowerCase(), false));
                if (c.remoteParty.toLowerCase().indexOf('@guest.')) {
                }
                if (c.remoteParty.toLowerCase().indexOf('@conference.')) {
                }
                if (existing_contacts.length === 0) {
                    contacts.push(c);
                }
            });
        }

        return contacts;
    }

    get favoritesContacts() {
        let favoriteContacts = [];
        let displayName = '';
        let conference = false;

        this.state.favoriteUris.forEach((uri) => {

            if (!uri) {
                return;
            }

            uri = uri.toLowerCase();

            displayName = '';

            if (this.state.myContacts && this.state.myContacts.hasOwnProperty(uri)) {
                displayName = this.state.myContacts[uri].name;
            }

            conference = false;

            let tags = ['favorite'];

            if (uri.indexOf('@videoconference.') > -1) {
                displayName = uri.split('@')[0];
                const room = uri.split('@')[0];
                uri = room + '@' + config.defaultConferenceDomain;
                conference = true;
                tags.push('conference');
            }

            const item = {
                remoteParty: uri,
                displayName: displayName,
                conference: conference,
                type: 'contact',
                id: uuid.v4(),
                tags: tags
                };

            favoriteContacts.push(item);
        });

        return favoriteContacts;
    }

    conferenceByUri(urlParameters) {
        const targetUri = utils.normalizeUri(urlParameters.targetUri, config.defaultConferenceDomain);
        const idx = targetUri.indexOf('@');
        const uri = {};
        const pattern = /^[A-Za-z0-9\-\_]+$/g;
        uri.user = targetUri.substring(0, idx);

        // check if the uri.user is valid
        if (!pattern.test(uri.user)) {
            const status = {
                title   : 'Invalid conference',
                message : `Oops, the conference ID is invalid: ${targetUri}`,
                level   : 'danger',
                width   : 'large'
            }
            return (
                <StatusBox
                    {...status}
                />
            );
        }

        return (
            <ConferenceByUriBox
                notificationCenter = {this.notificationCenter}
                handler = {this.handleConferenceByUri}
                targetUri = {targetUri}
                localMedia = {this.state.localMedia}
                account = {this.state.account}
                currentCall = {this.state.currentCall}
                hangupCall = {this.hangupCall}
                shareScreen = {this.switchScreensharing}
                generatedVideoTrack = {this.state.generatedVideoTrack}
            />
        );
    }

    login() {
        let registerBox;
        let statusBox;
        this.mustLogout = false;

        if (this.state.status !== null) {
            statusBox = (
                <StatusBox
                    message={this.state.status.msg}
                    level={this.state.status.level}
                />
            );
        }

        if (this.state.registrationState !== 'registered') {
            registerBox = (
                <RegisterBox
                    registrationInProgress = {this.state.registrationState !== null && this.state.registrationState !== 'failed'}
                    handleRegistration = {this.handleRegistration}
                    autoLogin={this.state.autoLogin}
                    orientation = {this.state.orientation}
                    isTablet = {this.state.isTablet}
                    phoneNumber= {this.state.phoneNumber}
                />
            );
        }

        return (
            <Fragment>
                {registerBox}
                {statusBox}
            </Fragment>
        );
    }

    logout() {
        this.callKeeper.setAvailable(false);

        if (!this.mustLogout && this.state.registrationState !== null && this.state.connection && this.state.connection.state === 'ready') {
            // remove token from server
            this.mustLogout = true;
            this.state.account.setDeviceToken('None', Platform.OS, deviceId, true, bundleId);
            this.state.account.register();
            return;
        } else if (this.mustLogout && this.state.connection && this.state.account) {
            this.state.account.unregister();
        }

        this.tokenSent = false;
        if (this.state.connection && this.state.account) {
            this.state.connection.removeAccount(this.state.account, (error) => {
                if (error) {
                    logger.debug(error);
                }
            });
        }

        //this.lastSyncedMessageId = null;

        storage.set('account', {accountId: this.state.accountId,
                                password: this.state.password});
//                                lastSyncedMessageId: null});

        this.serverHistory = [];
        this.setState({account: null,
                       registrationState: null,
                       registrationKeepalive: false,
                       status: null,
                       autoLogin: false,
                       history: [],
                       localHistory: [],
                       cachedHistory: [],
                       defaultDomain: config.defaultDomain
                       });

        this.changeRoute('/login', 'user logout');
        return null;
    }

    main() {
        return null;
    }
}

export default Sylk;
