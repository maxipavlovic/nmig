/*
 * This file is a part of "NMIG" - the database migration tool.
 *
 * Copyright (C) 2016 - present, Anatoly Khaytovich <anatolyuss@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program (please see the "LICENSE.md" file).
 * If not, see <http://www.gnu.org/licenses/gpl.txt>.
 *
 * @author Anatoly Khaytovich <anatolyuss@gmail.com>
 */
'use strict';

const generateError = require('./ErrorGenerator');
const log           = require('./Logger');
const connect       = require('./Connector');

/**
 * Decodes binary data in GEOMETRY columns from from textual representation in string.
 *
 * @param {Conversion} conversion
 *
 * @returns {Promise<Any>}
 */
const decodeGeometry = conversion => {
    return connect(conversion).then(() => {
        return new Promise(resolve => {
            //

            resolve();
        });
    });
};

/**
 * Decodes binary data in BYTEA columns from from textual representation in string.
 *
 * @param {Conversion} conversion
 *
 * @returns {Promise<Any>}
 */
const decodeBytea = conversion => {
    log(conversion, '\t--[decodeBytea] Decodes binary data in BYTEA columns from from textual representation in string.');

    return connect(conversion).then(() => {
        return new Promise(resolve => {
            conversion._pg.connect((error, client, release) => {
                if (error) {
                    generateError(conversion, '\t--[decodeBytea] Cannot connect to PostgreSQL server...');
                    return resolve();
                }

                let sql = `SELECT table_name, column_name 
                    FROM information_schema.columns
                    WHERE table_catalog = '${ conversion._targetConString.database }' 
                      AND table_schema = '${ conversion._schema }' 
                      AND data_type = 'bytea';`;

                client.query(sql, (err, data) => {
                    release();

                    if (err) {
                        generateError(conversion, `\t--[decodeBytea] ${ err }`, sql);
                        return resolve();
                    }

                    const decodePromises = [];

                    for (let i = 0; i < data.rows.length; ++i) {
                        decodePromises.push(new Promise(resolveDecode => {
                            conversion._pg.connect((connectionError, pgClient, clientRelease) => {
                                if (connectionError) {
                                    generateError(conversion, '\t--[decodeBytea] Cannot connect to PostgreSQL server...');
                                    return resolveDecode();
                                }

                                sql = `UPDATE ${ conversion._schema }.${ data.rows[i].table_name }
                                SET ${ data.rows[i].column_name } = DECODE(ENCODE(${ data.rows[i].column_name }, 'escape'), 'hex');`;

                                pgClient.query(sql, decodeError => {
                                    clientRelease();

                                    if (decodeError) {
                                        generateError(conversion, `\t--[decodeBytea] ${ decodeError }`);
                                        return resolveDecode();
                                    }

                                    resolveDecode();
                                });
                            });
                        }));
                    }

                    Promise.all(decodePromises).then(() => resolve());
                });
            });
        });
    });
};

/**
 * Decodes binary data from from textual representation in string.
 *
 * @param {Conversion} conversion
 *
 * @returns {Promise<Conversion>}
 */
module.exports = conversion => {
    return new Promise(resolve => {
        Promise.all([
            decodeBytea(conversion),
            decodeGeometry(conversion),
        ])
        .then(() => resolve(conversion));
    });
};
