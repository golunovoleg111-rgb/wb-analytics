# Sync engine test cases

1. Two operations with different IDs for different keys are both accepted.
2. Re-sending the same operation ID is ignored by the LAN append path.
3. Invalid operations without id/deviceId/store/type/key are rejected.
4. Conflicting changes for the same store/key are not silently resolved.
5. Exported sync journal includes deviceId and operation list.
