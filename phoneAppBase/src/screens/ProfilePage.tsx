import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView } from 'react-native';

const ProfilePage = () => {
  const [phoneNumber, setPhoneNumber] = useState<string>('123-456-7890');
  const [password, setPassword] = useState<string>('');
  
  const handlePhoneChange = (newPhone: string) => {
    setPhoneNumber(newPhone);
  };

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        //add account deletion
      ]
    );
  };

  const handleSignOut = () => {
    //add sign out
  };

  const handleSaveChanges = () => {
    //add updated phone number
    //add change password
  };

  //add pulling data from signed in user
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      
      <TextInput style={styles.input} value="Test Name" editable={false} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value="testemail@gmail.com" editable={false} />

      <Text style={styles.label}>Company</Text>
      <TextInput style={styles.input} value="TEST COMPANY" editable={false} />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        value={phoneNumber}
        onChangeText={handlePhoneChange}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={handlePasswordChange}
        secureTextEntry
        placeholder="Enter new password"
      />

      <Button title="Save Changes" onPress={handleSaveChanges} />

      <View style={styles.divider} />

      <Button title="Delete Account" color="red" onPress={handleDeleteAccount} />
      <Button title="Sign Out" color="gray" onPress={handleSignOut} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  divider: {
    height: 20,
  },
});

export default ProfilePage;
