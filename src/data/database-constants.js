// define some constants - system info "userId" and invoke info "document name"
exports.systemInfo = '__system_info';
exports.invokeInfo = '__invoke_info';

// name of history "collection" and metadata "collection"
exports.history = '__history';

// metadata field names which get spliced in with data
exports.metadataIdField = '__id';
exports.metadataUserIdField = '__userId';
exports.metadataProviderField = '__provider';
exports.metadataSentimentField = '__sentiment';
exports.metadataSentimentScoreField = '__sentimentScore';
exports.metadataTextField = '__text';

// various section names for __system_info and profile
exports.dataPipelineSection = 'dataPipeline';
exports.loadSection = 'load';
exports.snapshotSection = 'snapshot';
exports.lastUpdatedTimestamp = 'lastUpdatedTimestamp';
exports.inProgress = 'inProgress';
exports.refreshHistory = 'refreshHistory';
exports.profile = 'profile';